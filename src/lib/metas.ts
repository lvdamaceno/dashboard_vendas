import "server-only";
import { sql } from "./db";

// Metas mensais de faturamento líquido (painel.meta), por loja: dois valores por loja e mês.
export const META_LOJA = 0;
/** A mesma meta para cada vendedor ativo da loja */
export const META_VENDEDOR = -1;

export interface Goal {
  codemp: number;
  codvend: number;
  valor: number;
}

export interface StoreGoals {
  loja: number | null;
  vendedor: number | null;
}

/** Metas do mês (AAAA-MM-01) por loja; com codemp, só a daquela loja. */
export async function listGoals(mes: string, codemp?: number) {
  const rows = await sql<Goal>(
    `SELECT codemp, codvend, valor::float8 AS valor FROM painel.meta
      WHERE mes = $1::date AND codvend IN (${META_LOJA}, ${META_VENDEDOR}) ${codemp ? "AND codemp = $2" : ""}`,
    codemp ? [mes, codemp] : [mes],
  );
  const byStore = new Map<number, StoreGoals>();
  for (const r of rows) {
    const g = byStore.get(r.codemp) ?? { loja: null, vendedor: null };
    if (r.codvend === META_LOJA) g.loja = r.valor;
    else g.vendedor = r.valor;
    byStore.set(r.codemp, g);
  }
  return byStore;
}

/** Grava as metas do mês de várias lojas: valor null apaga. */
export async function saveGoals(mes: string, entries: { codemp: number; codvend: number; valor: number | null }[], autor: string) {
  const apagar = entries.filter((e) => e.valor === null);
  const gravar = entries.filter((e): e is { codemp: number; codvend: number; valor: number } => e.valor !== null);
  if (apagar.length) {
    await sql(
      `DELETE FROM painel.meta m USING unnest($2::int[], $3::int[]) AS t(e, v) WHERE m.mes = $1::date AND m.codemp = t.e AND m.codvend = t.v`,
      [mes, apagar.map((e) => e.codemp), apagar.map((e) => e.codvend)],
    );
  }
  if (gravar.length) await upsertGoals(mes, gravar, autor, true);
}

async function upsertGoals(mes: string, goals: Goal[], autor: string, overwrite: boolean) {
  const rows = await sql(
    `INSERT INTO painel.meta (mes, codemp, codvend, valor, autor_nome)
     SELECT $1::date, e, v, x, $5 FROM unnest($2::int[], $3::int[], $4::numeric[]) AS t(e, v, x)
     ON CONFLICT (mes, codemp, codvend) DO ${overwrite ? "UPDATE SET valor = EXCLUDED.valor, autor_nome = EXCLUDED.autor_nome, atualizado_em = now()" : "NOTHING"}
     RETURNING codvend`,
    [mes, goals.map((g) => g.codemp), goals.map((g) => g.codvend), goals.map((g) => g.valor), autor],
  );
  return rows.length;
}

export interface GoalPerson {
  codemp: number;
  codvend: number;
  nome: string;
}

/** Pessoas consideradas na meta individual de cada loja no mês (uma loja por pessoa). */
export async function listGoalPeople(mes: string) {
  return sql<GoalPerson>(`SELECT codemp, codvend, nome FROM painel.meta_pessoa WHERE mes = $1::date ORDER BY nome`, [mes]);
}

/** Troca as pessoas consideradas das lojas informadas no mês. */
export async function saveGoalPeople(mes: string, lojas: number[], people: GoalPerson[]) {
  if (!lojas.length) return;
  await sql(`DELETE FROM painel.meta_pessoa WHERE mes = $1::date AND (codemp = ANY($2::int[]) OR codvend = ANY($3::int[]))`, [
    mes,
    lojas,
    people.map((p) => p.codvend),
  ]);
  if (people.length) {
    await sql(
      `INSERT INTO painel.meta_pessoa (mes, codemp, codvend, nome)
       SELECT $1::date, e, v, n FROM unnest($2::int[], $3::int[], $4::text[]) AS t(e, v, n)
       ON CONFLICT (mes, codvend) DO UPDATE SET codemp = EXCLUDED.codemp, nome = EXCLUDED.nome`,
      [mes, people.map((p) => p.codemp), people.map((p) => p.codvend), people.map((p) => p.nome)],
    );
  }
}

/** Copia metas e pessoas consideradas de um mês para outro sem mexer no que já foi preenchido; retorna quantas metas entraram. */
export async function copyGoals(from: string, to: string, autor: string) {
  const rows = await sql<Goal>(
    `SELECT codemp, codvend, valor::float8 AS valor FROM painel.meta WHERE mes = $1::date AND codvend IN (${META_LOJA}, ${META_VENDEDOR})`,
    [from],
  );
  const copiadas = rows.length ? await upsertGoals(to, rows, autor, false) : 0;
  await sql(
    `INSERT INTO painel.meta_pessoa (mes, codemp, codvend, nome)
     SELECT $2::date, codemp, codvend, nome FROM painel.meta_pessoa WHERE mes = $1::date
     ON CONFLICT (mes, codvend) DO NOTHING`,
    [from, to],
  );
  return copiadas;
}

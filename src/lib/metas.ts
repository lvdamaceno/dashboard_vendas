import "server-only";
import { sql } from "./db";

// Metas mensais de faturamento líquido (painel.meta). codvend 0 = meta geral da loja.

export interface Goal {
  codemp: number;
  codvend: number;
  valor: number;
}

/** Metas do mês (AAAA-MM-01); com codemp, só as daquela loja. */
export async function listGoals(mes: string, codemp?: number) {
  return sql<Goal>(
    `SELECT codemp, codvend, valor::float8 AS valor FROM painel.meta WHERE mes = $1::date ${codemp ? "AND codemp = $2" : ""}`,
    codemp ? [mes, codemp] : [mes],
  );
}

/** Grava as metas de uma loja no mês: valor null apaga a meta. */
export async function saveGoals(mes: string, codemp: number, entries: { codvend: number; valor: number | null }[], autor: string) {
  const apagar = entries.filter((e) => e.valor === null).map((e) => e.codvend);
  const gravar = entries.filter((e): e is { codvend: number; valor: number } => e.valor !== null);
  if (apagar.length) {
    await sql(`DELETE FROM painel.meta WHERE mes = $1::date AND codemp = $2 AND codvend = ANY($3::int[])`, [mes, codemp, apagar]);
  }
  if (gravar.length) {
    await sql(
      `INSERT INTO painel.meta (mes, codemp, codvend, valor, autor_nome)
       SELECT $1::date, $2, v.codvend, v.valor, $5 FROM unnest($3::int[], $4::numeric[]) AS v(codvend, valor)
       ON CONFLICT (mes, codemp, codvend) DO UPDATE SET valor = EXCLUDED.valor, autor_nome = EXCLUDED.autor_nome, atualizado_em = now()`,
      [mes, codemp, gravar.map((g) => g.codvend), gravar.map((g) => g.valor), autor],
    );
  }
}

/** Grava metas sem mexer nas que já existem no mês (para copiar do mês anterior); retorna quantas entraram. */
export async function insertMissingGoals(mes: string, goals: Goal[], autor: string) {
  if (!goals.length) return 0;
  const rows = await sql(
    `INSERT INTO painel.meta (mes, codemp, codvend, valor, autor_nome)
     SELECT $1::date, e, v, x, $5 FROM unnest($2::int[], $3::int[], $4::numeric[]) AS t(e, v, x)
     ON CONFLICT (mes, codemp, codvend) DO NOTHING
     RETURNING codvend`,
    [mes, goals.map((g) => g.codemp), goals.map((g) => g.codvend), goals.map((g) => g.valor), autor],
  );
  return rows.length;
}

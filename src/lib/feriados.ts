import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { workdaysOfMonth, type HolidayAdjustment } from "./workdays";

/** Ajustes de feriado do admin no ano (AAAA). */
export async function listHolidayAdjustments(year: number) {
  return sql<HolidayAdjustment>(
    `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, nome, fecha FROM painel.feriado
      WHERE dia >= make_date($1, 1, 1) AND dia < make_date($1 + 1, 1, 1) ORDER BY dia`,
    [year],
  );
}

export async function saveHolidayAdjustment(a: HolidayAdjustment, autor: string) {
  await sql(
    `INSERT INTO painel.feriado (dia, nome, fecha, autor_nome) VALUES ($1::date, $2, $3, $4)
     ON CONFLICT (dia) DO UPDATE SET nome = EXCLUDED.nome, fecha = EXCLUDED.fecha, autor_nome = EXCLUDED.autor_nome, atualizado_em = now()`,
    [a.dia, a.nome, a.fecha, autor],
  );
}

/** Grava vários ajustes sem mexer nos que já existem naquele dia; retorna quantos entraram. */
export async function insertHolidayAdjustments(items: HolidayAdjustment[], autor: string) {
  if (!items.length) return 0;
  const rows = await sql(
    `INSERT INTO painel.feriado (dia, nome, fecha, autor_nome)
     SELECT d, n, f, $4 FROM unnest($1::date[], $2::text[], $3::boolean[]) AS t(d, n, f)
     ON CONFLICT (dia) DO NOTHING
     RETURNING dia`,
    [items.map((i) => i.dia), items.map((i) => i.nome), items.map((i) => i.fecha), autor],
  );
  return rows.length;
}

export async function deleteHolidayAdjustment(dia: string) {
  await sql(`DELETE FROM painel.feriado WHERE dia = $1::date`, [dia]);
}

/** Dias úteis do mês com os ajustes do admin (se o banco falhar, usa só o calendário calculado). */
export async function monthWorkdays(mes: string) {
  const ajustes = await listHolidayAdjustments(Number(mes.slice(0, 4))).catch((err) => {
    console.error("[feriados] ajustes:", err instanceof Error ? err.message : err);
    return [];
  });
  return workdaysOfMonth(mes, env().META_DIAS_SEMANA, ajustes);
}

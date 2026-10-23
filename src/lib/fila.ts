import "server-only";
import { sql } from "./db";

// Fila de atendimento (painel.fila): uma por loja por dia. O dia da fila vira às 7h de Brasília,
// então às 7h todo mundo sai da fila sem precisar de tarefa agendada.
const DIA = `(now() AT TIME ZONE 'America/Sao_Paulo' - interval '7 hours')::date`;

export interface QueueEntry {
  codvend: number;
  nome: string;
  posicao: number;
  atendendo: boolean;
  entrouEm: Date;
  /** Versão da foto (para o navegador buscar de novo quando troca); null = sem foto */
  fotoVersao: number | null;
}

/** Primeiro que está esperando (não atendendo) na fila da loja. */
export async function nextWaiting(codemp: number) {
  const rows = await sql<{ codvend: number; nome: string }>(
    `SELECT codvend, nome FROM painel.fila WHERE dia = ${DIA} AND codemp = $1 AND NOT atendendo ORDER BY posicao, entrou_em LIMIT 1`,
    [codemp],
  );
  return rows[0] ?? null;
}

export async function listQueue(codemp: number) {
  return sql<QueueEntry>(
    `SELECT f.codvend, f.nome, f.posicao, f.atendendo, f.entrou_em AS "entrouEm",
            (extract(epoch FROM p.atualizado_em) * 1000)::bigint::float8 AS "fotoVersao"
       FROM painel.fila f
       LEFT JOIN painel.foto p ON p.codvend = f.codvend
      WHERE f.dia = ${DIA} AND f.codemp = $1
      ORDER BY f.posicao, f.entrou_em`,
    [codemp],
  );
}

/** Entra no fim da fila (se já estiver, não muda nada). */
export async function joinQueue(codemp: number, codvend: number, nome: string) {
  await sql(
    `INSERT INTO painel.fila (dia, codemp, codvend, nome, posicao)
     SELECT ${DIA}, $1, $2, $3, COALESCE(MAX(posicao), 0) + 1 FROM painel.fila WHERE dia = ${DIA} AND codemp = $1
     ON CONFLICT (dia, codemp, codvend) DO NOTHING`,
    [codemp, codvend, nome],
  );
  // Limpeza: filas de dias anteriores não servem mais
  sql(`DELETE FROM painel.fila WHERE dia < ${DIA} - 7`).catch(() => undefined);
}

export type ServiceResult = "vendeu" | "nao_vendeu" | "so_olhando";
export type LossReason = "preco" | "sem_produto" | "vai_voltar" | "outro";

/** Fecha atendimentos que ficaram abertos (saiu da fila, foi tirado, atendeu de novo sem terminar): sem resultado. */
async function closeOpenServices(codvend: number) {
  await sql(`UPDATE painel.atendimento SET fim = now() WHERE codvend = $1 AND fim IS NULL`, [codvend]);
}

/** Vai atender: marca como atendendo, vai para o fim da fila e abre o registro do atendimento. */
export async function startService(codemp: number, codvend: number, nome: string) {
  await closeOpenServices(codvend);
  await sql(`INSERT INTO painel.atendimento (dia, codemp, codvend, nome) VALUES (${DIA}, $1, $2, $3)`, [codemp, codvend, nome]);
  await sql(
    `UPDATE painel.fila SET atendendo = true, atualizado_em = now(),
            posicao = (SELECT COALESCE(MAX(posicao), 0) + 1 FROM painel.fila WHERE dia = ${DIA} AND codemp = $1)
      WHERE dia = ${DIA} AND codemp = $1 AND codvend = $2`,
    [codemp, codvend],
  );
}

/** Terminou o atendimento: volta a esperar na posição em que está e registra o resultado. */
export async function finishService(codemp: number, codvend: number, resultado?: ServiceResult, motivo?: LossReason) {
  await sql(
    `UPDATE painel.atendimento SET fim = now(), resultado = $2, motivo = $3 WHERE codvend = $1 AND fim IS NULL`,
    [codvend, resultado ?? null, resultado === "nao_vendeu" ? (motivo ?? null) : null],
  );
  await sql(`UPDATE painel.fila SET atendendo = false, atualizado_em = now() WHERE dia = ${DIA} AND codemp = $1 AND codvend = $2`, [
    codemp,
    codvend,
  ]);
}

export async function leaveQueue(codemp: number, codvend: number) {
  await closeOpenServices(codvend);
  await sql(`DELETE FROM painel.fila WHERE dia = ${DIA} AND codemp = $1 AND codvend = $2`, [codemp, codvend]);
}

/** Gerente reorganiza: grava a nova ordem; quem não veio na lista mantém a ordem relativa, depois. */
export async function reorderQueue(codemp: number, order: number[]) {
  await sql(
    `WITH nova AS (SELECT codvend, ord FROM unnest($2::int[]) WITH ORDINALITY AS t(codvend, ord)),
          numerada AS (
            SELECT f.codvend, ROW_NUMBER() OVER (ORDER BY n.ord NULLS LAST, f.posicao, f.entrou_em) AS pos
              FROM painel.fila f LEFT JOIN nova n ON n.codvend = f.codvend
             WHERE f.dia = ${DIA} AND f.codemp = $1)
     UPDATE painel.fila f SET posicao = numerada.pos, atualizado_em = now()
       FROM numerada
      WHERE f.dia = ${DIA} AND f.codemp = $1 AND f.codvend = numerada.codvend`,
    [codemp, order],
  );
}

// --- fotos ---

export async function getPhoto(codvend: number) {
  const rows = await sql<{ dados: Buffer }>(`SELECT dados FROM painel.foto WHERE codvend = $1`, [codvend]);
  return rows[0]?.dados ?? null;
}

export async function savePhoto(codvend: number, dados: Buffer) {
  await sql(
    `INSERT INTO painel.foto (codvend, dados) VALUES ($1, $2)
     ON CONFLICT (codvend) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [codvend, dados],
  );
}

export async function deletePhoto(codvend: number) {
  await sql(`DELETE FROM painel.foto WHERE codvend = $1`, [codvend]);
}

export async function photoVersion(codvend: number) {
  const rows = await sql<{ v: number }>(`SELECT (extract(epoch FROM atualizado_em) * 1000)::bigint::float8 AS v FROM painel.foto WHERE codvend = $1`, [codvend]);
  return rows[0]?.v ?? null;
}

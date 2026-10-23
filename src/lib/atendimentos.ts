import "server-only";
import { sql } from "./db";
import type { Session } from "./session";

// Atendimentos registrados pela fila (painel.atendimento): conversão e motivos de perda.

export interface ServiceRow {
  codemp: number;
  codvend: number;
  nome: string;
  total: number;
  vendeu: number;
  naoVendeu: number;
  soOlhando: number;
  /** atendimentos sem resultado (saiu da fila, foi tirado ou ainda está atendendo) */
  semRegistro: number;
  /** minutos, só dos atendimentos encerrados */
  tempoMedio: number | null;
}

export interface ServiceStats {
  linhas: ServiceRow[];
  motivos: { motivo: "preco" | "sem_produto" | "vai_voltar" | "outro"; total: number }[];
}

/** Conversão = vendeu ÷ atendimentos com resultado registrado. */
export const conversao = (r: Pick<ServiceRow, "vendeu" | "naoVendeu" | "soOlhando">) => {
  const com = r.vendeu + r.naoVendeu + r.soOlhando;
  return com ? r.vendeu / com : null;
};

/**
 * Atendimentos no intervalo, no escopo da sessão: vendedor só os dele; gerente a loja; master/admin a loja escolhida
 * (codemp) ou todas. vendedor: filtro opcional de quem vê a loja.
 */
export async function serviceStats(session: Session, from: string, to: string, vendedor?: number): Promise<ServiceStats> {
  const codvend = session.role === "vendedor" ? session.codvend : (vendedor ?? null);
  const codemp = session.role === "vendedor" ? null : session.role === "gerente" || session.codemp ? session.codemp : null;
  const params = [from, to, codemp, codvend];
  const where = `dia BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR codemp = $3) AND ($4::int IS NULL OR codvend = $4)`;
  const [linhas, motivos] = await Promise.all([
    sql<ServiceRow>(
      `SELECT codemp, codvend, max(nome) AS nome, count(*)::int AS total,
              count(*) FILTER (WHERE resultado = 'vendeu')::int AS vendeu,
              count(*) FILTER (WHERE resultado = 'nao_vendeu')::int AS "naoVendeu",
              count(*) FILTER (WHERE resultado = 'so_olhando')::int AS "soOlhando",
              count(*) FILTER (WHERE resultado IS NULL)::int AS "semRegistro",
              round((avg(extract(epoch FROM fim - inicio)) FILTER (WHERE fim IS NOT NULL AND resultado IS NOT NULL) / 60)::numeric, 1)::float8 AS "tempoMedio"
         FROM painel.atendimento WHERE ${where}
        GROUP BY codemp, codvend
        ORDER BY count(*) FILTER (WHERE resultado = 'vendeu') DESC, count(*) DESC`,
      params,
    ),
    sql<ServiceStats["motivos"][number]>(
      `SELECT motivo, count(*)::int AS total FROM painel.atendimento
        WHERE ${where} AND resultado = 'nao_vendeu' AND motivo IS NOT NULL
        GROUP BY motivo ORDER BY total DESC`,
      params,
    ),
  ]);
  return { linhas, motivos };
}

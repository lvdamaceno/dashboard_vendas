import "server-only";
import type { Session } from "../session";
import { query } from "./client";
import { str } from "./sql";

export class ProfileError extends Error {}

/**
 * Identifica quem entra pelo CPF:
 *  1. funcionário ativo e não demitido em TFPFUN → CODFUNC + CODEMP (a empresa entra no
 *     filtro porque o mesmo CODFUNC pode existir em empresas diferentes);
 *  2. gerente: registro ativo em TGFVEN com esse CODFUNC + CODEMP e TIPVEND S (supervisor)
 *     ou G (gerente) → vê as vendas da loja (CODEMP);
 *  3. senão, vendedor: TSIUSU pelo mesmo CODFUNC + CODEMP → TSIUSU.CODVEND.
 */
export async function fetchProfile(cpf: string): Promise<Session> {
  const rows = await query(
    `SELECT FUN.CODFUNC, FUN.CODEMP, FUN.NOMEFUNC,
            GER.CODVEND AS GER_CODVEND, GER.APELIDO AS GER_APELIDO, GER.CODEMP AS GER_CODEMP,
            COALESCE(USU.CODVEND, 0) AS USU_CODVEND, VEN.APELIDO AS VEN_APELIDO, VEN.ATIVO AS VEN_ATIVO
       FROM TFPFUN FUN
       LEFT JOIN TGFVEN GER
              ON GER.CODFUNC = FUN.CODFUNC AND GER.CODEMP = FUN.CODEMP AND GER.ATIVO = 'S'
             AND GER.TIPVEND IN ('S', 'G')
       LEFT JOIN TSIUSU USU ON USU.CODEMP = FUN.CODEMP AND USU.CODFUNC = FUN.CODFUNC
       LEFT JOIN TGFVEN VEN ON VEN.CODVEND = USU.CODVEND
      WHERE FUN.CPF = ${str(cpf)}
        AND FUN.SITUACAO <> 0
        AND FUN.DTDEM IS NULL`,
  );

  if (!rows.length) throw new ProfileError("CPF não encontrado como funcionário ativo no Sankhya.");

  const managers = rows.filter((r) => Number(r.GER_CODVEND));
  if (managers.length) {
    // Gerente de mais de uma loja: não dá para saber qual relatório mostrar
    if (new Set(managers.map((r) => Number(r.GER_CODEMP))).size > 1) {
      throw new ProfileError("Seu CPF está como gerente em mais de uma loja. Procure o administrador do Sankhya.");
    }
    const row = managers[0];
    return {
      codfunc: Number(row.CODFUNC),
      codemp: Number(row.GER_CODEMP),
      nome: String(row.NOMEFUNC ?? "").trim(),
      codvend: Number(row.GER_CODVEND),
      apelido: String(row.GER_APELIDO ?? row.NOMEFUNC),
      role: "gerente",
    };
  }

  const linked = rows.filter((r) => Number(r.USU_CODVEND));
  if (!linked.length) throw new ProfileError("Seu usuário não possui um vendedor vinculado no Sankhya.");
  const active = linked.filter((r) => r.VEN_ATIVO === "S");
  if (!active.length) throw new ProfileError("O vendedor vinculado ao seu usuário está inativo.");
  // Funcionário em mais de uma empresa: só segue se todos apontam para o mesmo vendedor
  if (new Set(active.map((r) => Number(r.USU_CODVEND))).size > 1) {
    throw new ProfileError("Seu CPF está vinculado a mais de um vendedor ativo. Procure o administrador do Sankhya.");
  }
  const row = active[0];
  return {
    codfunc: Number(row.CODFUNC),
    codemp: Number(row.CODEMP),
    nome: String(row.NOMEFUNC ?? "").trim(),
    codvend: Number(row.USU_CODVEND),
    apelido: String(row.VEN_APELIDO ?? row.NOMEFUNC),
    role: "vendedor",
  };
}

import "server-only";
import { env } from "../env";
import type { Session } from "../session";
import { query } from "./client";
import { str } from "./sql";

export class ProfileError extends Error {}

/**
 * Busca o vendedor pelo CPF: funcionário (TFPFUN, por CPF) → usuário (TSIUSU, pelo
 * par CODEMP + CODFUNC, já que o mesmo CODFUNC pode existir em empresas diferentes)
 * → vendedor vinculado (TSIUSU.CODVEND) e perfil.
 */
export async function fetchProfile(cpf: string): Promise<Session> {
  const rows = await query(
    `SELECT USU.CODUSU, USU.NOMEUSU, COALESCE(USU.CODVEND, 0) AS CODVEND,
            VEN.APELIDO, VEN.TIPVEND, VEN.ATIVO,
            COALESCE(VEN.CODEMP, FUN.CODEMP) AS CODEMP
       FROM TFPFUN FUN
       JOIN TSIUSU USU ON USU.CODEMP = FUN.CODEMP AND USU.CODFUNC = FUN.CODFUNC
       LEFT JOIN TGFVEN VEN ON VEN.CODVEND = USU.CODVEND
      WHERE REPLACE(REPLACE(REPLACE(FUN.CPF, '.', ''), '-', ''), ' ', '') = ${str(cpf)}`,
  );

  if (!rows.length) throw new ProfileError("CPF não encontrado como usuário no Sankhya.");
  const linked = rows.filter((r) => Number(r.CODVEND));
  if (!linked.length) throw new ProfileError("Seu usuário não possui um vendedor vinculado no Sankhya.");
  const active = linked.filter((r) => r.ATIVO === "S");
  if (!active.length) throw new ProfileError("O vendedor vinculado ao seu usuário está inativo.");
  // Funcionário em mais de uma empresa: só segue se todos apontam para o mesmo vendedor
  if (new Set(active.map((r) => Number(r.CODVEND))).size > 1) {
    throw new ProfileError("Seu CPF está vinculado a mais de um vendedor ativo. Procure o administrador do Sankhya.");
  }
  const row = active[0];
  const codvend = Number(row.CODVEND);

  const role = row.TIPVEND === env().MANAGER_TIPVEND ? "gerente" : "vendedor";
  const codemp = row.CODEMP == null || row.CODEMP === "" ? null : Number(row.CODEMP);
  if (role === "gerente" && env().MANAGER_SCOPE === "empresa" && !codemp) {
    throw new ProfileError("Gerente sem empresa/loja definida no cadastro de vendedor.");
  }

  return {
    codusu: Number(row.CODUSU),
    nome: String(row.NOMEUSU),
    codvend,
    apelido: String(row.APELIDO ?? row.NOMEUSU),
    role,
    codemp,
  };
}

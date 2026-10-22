import "server-only";
import { env } from "../env";
import type { Session } from "../session";
import { query } from "./client";
import { str } from "./sql";

export class ProfileError extends Error {}

/** Busca o usuário no Sankhya e determina o vendedor vinculado e o perfil. */
export async function fetchProfile(username: string): Promise<Session> {
  const rows = await query(
    `SELECT USU.CODUSU, USU.NOMEUSU, COALESCE(USU.CODVEND, 0) AS CODVEND,
            VEN.APELIDO, VEN.TIPVEND, VEN.ATIVO,
            COALESCE(VEN.CODEMP, USU.CODEMP) AS CODEMP
       FROM TSIUSU USU
       LEFT JOIN TGFVEN VEN ON VEN.CODVEND = USU.CODVEND
      WHERE UPPER(USU.NOMEUSU) = UPPER(${str(username)})`,
  );

  if (rows.length !== 1) throw new ProfileError("Usuário não encontrado no Sankhya.");
  const row = rows[0];
  const codvend = Number(row.CODVEND);
  if (!codvend) throw new ProfileError("Seu usuário não possui um vendedor vinculado no Sankhya.");
  if (row.ATIVO !== "S") throw new ProfileError("O vendedor vinculado ao seu usuário está inativo.");

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

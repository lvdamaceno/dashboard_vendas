import "server-only";
import { query } from "./client";
import { int } from "./sql";

export interface Contact {
  nome: string | null;
  /** Só dígitos, com DDD (10 ou 11 dígitos) */
  telefone: string | null;
}

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");

/** Nome e telefone (TFPFUN.TELEFONE) do funcionário vinculado ao usuário, por CODEMP + CODFUNC. */
export async function fetchContact(codusu: number): Promise<Contact> {
  const rows = await query(
    `SELECT FUN.NOMEFUNC, FUN.TELEFONE
       FROM TSIUSU USU
       JOIN TFPFUN FUN ON FUN.CODEMP = USU.CODEMP AND FUN.CODFUNC = USU.CODFUNC
      WHERE USU.CODUSU = ${int(codusu)}`,
  );
  const row = rows[0];
  if (!row) return { nome: null, telefone: null };

  // Aceita com ou sem +55; precisa ter DDD (10 ou 11 dígitos)
  const tel = digits(row.TELEFONE).replace(/^55(?=\d{10,11}$)/, "");
  const telefone = tel.length === 10 || tel.length === 11 ? tel : null;
  if (!telefone) console.warn(`[cartao] usuário ${codusu} sem telefone válido com DDD em TFPFUN.TELEFONE`);

  const nome = String(row.NOMEFUNC ?? "").trim() || null;
  return { nome, telefone };
}

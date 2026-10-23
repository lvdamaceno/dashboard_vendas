import "server-only";
import { query } from "./client";
import { int } from "./sql";

export interface Contact {
  nome: string | null;
  /** Só dígitos, com DDD (10 ou 11 dígitos) */
  telefone: string | null;
}

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");

/** Nome e telefone (TFPFUN.TELEFONE) do funcionário, por CODEMP + CODFUNC. */
export async function fetchContact(codemp: number, codfunc: number): Promise<Contact> {
  const rows = await query(
    `SELECT FUN.NOMEFUNC, FUN.TELEFONE
       FROM TFPFUN FUN
      WHERE FUN.CODEMP = ${int(codemp)} AND FUN.CODFUNC = ${int(codfunc)}`,
  );
  const row = rows[0];
  if (!row) return { nome: null, telefone: null };

  // Aceita com ou sem +55; precisa ter DDD (10 ou 11 dígitos)
  const tel = digits(row.TELEFONE).replace(/^55(?=\d{10,11}$)/, "");
  const telefone = tel.length === 10 || tel.length === 11 ? tel : null;
  if (!telefone) console.warn(`[cartao] funcionário ${codfunc} (empresa ${codemp}) sem telefone válido com DDD em TFPFUN.TELEFONE`);

  const nome = String(row.NOMEFUNC ?? "").trim() || null;
  return { nome, telefone };
}

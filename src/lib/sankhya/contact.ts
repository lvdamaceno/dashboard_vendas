import "server-only";
import { query } from "./client";
import { int } from "./sql";

export interface Contact {
  nome: string | null;
  /** Só dígitos, com DDD (10 ou 11 dígitos) */
  telefone: string | null;
}

// Colunas de telefone do cadastro de funcionário, em ordem de preferência
// (celular primeiro, já que o atendimento é por WhatsApp)
const PHONE_COLUMNS = ["CELULAR", "TELCELULAR", "FONECELULAR", "TELEFONE", "FONE", "TELRESIDENCIAL"];

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");

/**
 * Nome e telefone do funcionário (TFPFUN) vinculado ao usuário. Lê todas as colunas
 * para não depender do nome exato do campo de telefone na versão do Sankhya.
 */
export async function fetchContact(codusu: number): Promise<Contact> {
  const rows = await query(
    `SELECT FUN.*
       FROM TSIUSU USU
       JOIN TFPFUN FUN ON FUN.CODEMP = USU.CODEMP AND FUN.CODFUNC = USU.CODFUNC
      WHERE USU.CODUSU = ${int(codusu)}`,
  );
  const row = rows[0];
  if (!row) return { nome: null, telefone: null };

  const ddd = digits(row.DDD);
  let telefone: string | null = null;
  for (const col of PHONE_COLUMNS) {
    let tel = digits(row[col]).replace(/^55(?=\d{10,11}$)/, "");
    if (tel.length === 8 || tel.length === 9) tel = ddd.length === 2 ? ddd + tel : "";
    if (tel.length === 10 || tel.length === 11) {
      telefone = tel;
      break;
    }
  }
  if (!telefone) {
    const available = Object.keys(row).filter((k) => /FONE|CEL|TEL/.test(k));
    console.warn(`[cartao] usuário ${codusu} sem telefone válido em TFPFUN (colunas encontradas: ${available.join(", ") || "nenhuma"})`);
  }

  const nome = String(row.NOMEFUNC ?? "").trim() || null;
  return { nome, telefone };
}

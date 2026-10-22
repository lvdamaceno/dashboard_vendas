import "server-only";

// Banco do Sankhya: SQL Server.
// Helpers para montar SQL com valores já validados. Nenhum valor vindo do
// navegador entra no SQL sem passar por um destes helpers.

export function int(n: number) {
  if (!Number.isSafeInteger(n)) throw new Error(`Inteiro inválido: ${n}`);
  return String(n);
}

export function str(s: string) {
  if (/[\u0000-\u001f]/.test(s)) throw new Error("Texto inválido");
  return `'${s.replace(/'/g, "''")}'`;
}

export function inList(values: (string | number)[]) {
  return values.map((v) => (typeof v === "number" ? int(v) : str(v))).join(", ");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Literal de data a partir de AAAA-MM-DD. */
export function date(iso: string) {
  if (!ISO_DATE.test(iso)) throw new Error(`Data inválida: ${iso}`);
  return `CONVERT(DATE, '${iso}', 23)`;
}

/** Expressão que formata uma coluna de data como AAAA-MM-DD. */
export function dayKey(column: string) {
  return `CONVERT(VARCHAR(10), ${column}, 23)`;
}

/** Limita o número de linhas de uma consulta que já possui ORDER BY. */
export function limit(sql: string, n: number) {
  return `${sql} OFFSET 0 ROWS FETCH NEXT ${int(n)} ROWS ONLY`;
}

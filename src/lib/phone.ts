// Telefones do cartão de visita (usado no servidor e no navegador)

/** Só dígitos, sem 0 inicial e sem o 55 do Brasil; null se não tiver DDD (10 ou 11 dígitos). */
export function normalizePhone(v: unknown) {
  const tel = String(v ?? "").replace(/\D/g, "").replace(/^0+/, "").replace(/^55(?=\d{10,11}$)/, "");
  return tel.length === 10 || tel.length === 11 ? tel : null;
}

export const formatPhone = (tel: string) =>
  tel.length === 11 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}` : `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}`;

// Valores em reais digitados (servidor e navegador)

/**
 * Lê "12.345,67", "12345,67", "R$ 12.345" ou "12345". Sem vírgula, os pontos são separador de milhar
 * (como se escreve no Brasil). Retorna null para vazio e NaN para texto inválido.
 */
export function parseMoney(text: string): number | null {
  const raw = text.replace(/R\$|\s/g, "");
  if (!raw) return null;
  if (!/^[\d.,]+$/.test(raw)) return NaN;
  const normal = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, "");
  const value = Number(normal);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoneyInput = (value: number | null | undefined) => (value ? fmt.format(value) : "");

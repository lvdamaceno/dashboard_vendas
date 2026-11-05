import "server-only";
import dados from "@/data/black-friday.json";

// Produtos da Black Friday, copiados da planilha da promoção (coluna "Desconto à vista" das abas de 20% a 50%).
// Cada linha do JSON: [código, descrição, desconto em %].
export interface ProdutoBF {
  codigo: number;
  descricao: string;
  desconto: number;
}

/** Sem acento, em maiúsculas e com espaços simples, para "Panelão" achar "PANELAO". */
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const PRODUTOS = (dados as unknown as [number, string, number][]).map(([codigo, descricao, desconto]) => ({
  codigo,
  descricao,
  desconto,
  texto: normalizar(descricao),
  cod: String(codigo),
}));

export const TOTAL_PRODUTOS_BF = PRODUTOS.length;
const BUSCA_MINIMA = 2;
const LIMITE = 20;

/**
 * Busca por código ou descrição: todas as palavras digitadas precisam aparecer, em qualquer ordem.
 * O código precisa bater desde o começo ("4364" acha 436423, "6423" não). Código exato vem primeiro,
 * depois os códigos que começam com o digitado, as descrições que começam com ele e o resto, em ordem alfabética.
 */
export function buscarProdutosBF(busca: string): { total: number; itens: ProdutoBF[] } {
  const termo = normalizar(busca);
  if (termo.length < BUSCA_MINIMA) return { total: 0, itens: [] };
  const palavras = termo.split(" ");
  const ordem = (p: (typeof PRODUTOS)[number]) => (p.cod === termo ? 0 : p.cod.startsWith(termo) ? 1 : p.texto.startsWith(termo) ? 2 : 3);
  const achados = PRODUTOS.filter((p) => palavras.every((w) => p.cod.startsWith(w) || p.texto.includes(w)));
  // sort é estável e a lista já está em ordem alfabética
  const itens = achados
    .sort((a, b) => ordem(a) - ordem(b))
    .slice(0, LIMITE)
    .map(({ codigo, descricao, desconto }) => ({ codigo, descricao, desconto }));
  return { total: achados.length, itens };
}

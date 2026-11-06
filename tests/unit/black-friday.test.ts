import { describe, expect, it } from "vitest";
import { buscarProdutosBF, TOTAL_PRODUTOS_BF } from "@/lib/black-friday-produtos";

describe("busca da Black Friday", () => {
  it("tem a lista inteira da planilha", () => expect(TOTAL_PRODUTOS_BF).toBe(6036));

  it("acha pelo código exato, com o desconto da planilha", () => {
    expect(buscarProdutosBF("436423").itens[0]).toEqual({ codigo: 436423, descricao: "TIGELA OXFORD EMPILHAVEIS 13CM 400ML BRANCO", desconto: 50 });
    expect(buscarProdutosBF(" 410434 ").itens[0]).toMatchObject({ codigo: 410434, desconto: 30 });
    expect(buscarProdutosBF("410438").itens[0]).toMatchObject({ codigo: 410438, desconto: 20 });
  });

  it("código só vale desde o começo", () => {
    expect(buscarProdutosBF("4364").itens.map((p) => p.codigo)).toContain(436423);
    expect(buscarProdutosBF("6423").itens.map((p) => p.codigo)).not.toContain(436423);
  });

  it("descrição: ignora acento e caixa, palavras em qualquer ordem", () => {
    const codigos = (q: string) => buscarProdutosBF(q).itens.map((p) => p.codigo);
    expect(codigos("tigela oxford empilhaveis 400ml branco")).toContain(436423);
    expect(codigos("BRANCO empilháveis tigela 400ml")).toContain(436423);
  });

  it("limita a 20 itens e informa o total", () => {
    const r = buscarProdutosBF("copo");
    expect(r.itens).toHaveLength(20);
    expect(r.total).toBeGreaterThan(20);
  });

  it("não acha o que não está na lista; busca curta não consulta", () => {
    expect(buscarProdutosBF("produto que nao existe")).toEqual({ total: 0, itens: [] });
    expect(buscarProdutosBF("a")).toEqual({ total: 0, itens: [] });
    expect(buscarProdutosBF("   ")).toEqual({ total: 0, itens: [] });
  });
});

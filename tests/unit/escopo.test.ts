import { describe, expect, it } from "vitest";
import { salesWhere, scopeWhere, serieValida } from "@/lib/sales";
import { date, inList, int, str } from "@/lib/sankhya/sql";
import type { Session } from "@/lib/session";

const s = (over: Partial<Session>): Session => ({ codfunc: 1, nome: "X", codvend: 10, apelido: "X", role: "vendedor", codemp: 3, ...over });

describe("escopo de acesso nas consultas do Sankhya", () => {
  it("vendedor só vê as próprias notas, mesmo pedindo outro vendedor", () => {
    expect(scopeWhere(s({ role: "vendedor", codvend: 10 }), 99)).toEqual(["CAB.CODVEND = 10"]);
  });

  it("gerente fica na própria loja; o filtro de vendedor só restringe", () => {
    expect(scopeWhere(s({ role: "gerente", codemp: 3 }))).toEqual(["CAB.CODEMP = 3"]);
    expect(scopeWhere(s({ role: "gerente", codemp: 3 }), 77)).toEqual(["CAB.CODEMP = 3", "CAB.CODVEND = 77"]);
  });

  it("gerente com loja 0 não vira 'todas as lojas'", () => {
    expect(scopeWhere(s({ role: "gerente", codemp: 0 }))).toEqual(["CAB.CODEMP = 0"]);
  });

  it("master e admin: loja escolhida ou todas", () => {
    expect(scopeWhere(s({ role: "master", codemp: 0 }))).toEqual([]);
    expect(scopeWhere(s({ role: "admin", codemp: 5 }))).toEqual(["CAB.CODEMP = 5"]);
  });

  it("a consulta de vendas sempre leva TOPs, série válida, datas e escopo", () => {
    const w = salesWhere(s({ role: "vendedor", codvend: 10 }), "2026-10-01", "2026-10-31");
    expect(w).toContain("CAB.CODTIPOPER IN (");
    expect(w).toContain("CAB.CODVEND = 10");
    expect(w).toContain("CONVERT(DATE, '2026-10-01', 23)");
    expect(w).toContain("CONVERT(DATE, '2026-11-01', 23)"); // fim exclusivo, dia seguinte
  });

  it("série da nota: sem conversão para número (séries como 'CF' não quebram a consulta)", () => {
    const expr = serieValida("CAB");
    expect(expr).not.toMatch(/CONVERT|CAST|> 0/);
    expect(expr).toContain("NOT LIKE '%[^0-9 ]%'");
  });
});

describe("valores no SQL", () => {
  it("inteiros e datas são validados", () => {
    expect(int(42)).toBe("42");
    expect(() => int(1.5)).toThrow();
    expect(() => int(Number.NaN)).toThrow();
    expect(() => date("2026-10-1")).toThrow();
    expect(() => date("2026-10-01'; DROP TABLE x;--")).toThrow();
  });

  it("textos têm aspas escapadas e caracteres de controle recusados", () => {
    expect(str("O'Brien")).toBe("'O''Brien'");
    expect(() => str("a\u0000b")).toThrow();
    expect(inList([1, "a'b"])).toBe("1, 'a''b'");
  });
});

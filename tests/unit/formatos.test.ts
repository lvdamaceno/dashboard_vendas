import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoney } from "@/lib/money-input";
import { formatPhone, normalizePhone } from "@/lib/phone";

describe("valores em reais digitados", () => {
  it.each([
    ["150.000,00", 150000],
    ["150000", 150000],
    ["R$ 1.234,5", 1234.5],
    ["12.000", 12000],
    ["", null],
  ] as const)("%s → %s", (txt, valor) => expect(parseMoney(txt)).toBe(valor));

  it("texto inválido vira NaN", () => expect(parseMoney("abc")).toBeNaN());
  it("formata com centavos", () => expect(formatMoneyInput(150000)).toBe("150.000,00"));
});

describe("telefones", () => {
  it.each([
    ["(91) 98888-1111", "91988881111"],
    ["+55 91 98888-1111", "91988881111"],
    ["091 3333-4444", "9133334444"],
    ["98888-1111", null],
  ] as const)("%s → %s", (txt, tel) => expect(normalizePhone(txt)).toBe(tel));

  it("formata celular e fixo", () => {
    expect(formatPhone("91988881111")).toBe("(91) 98888-1111");
    expect(formatPhone("9133334444")).toBe("(91) 3333-4444");
  });
});

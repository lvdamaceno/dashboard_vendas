import { describe, expect, it } from "vitest";
import { effectiveHolidays, holidays, workdaysOfMonth } from "@/lib/workdays";

const SEG_SAB = [1, 2, 3, 4, 5, 6];

describe("feriados de Belém", () => {
  it("datas móveis batem com o calendário oficial", () => {
    const h = (y: number) => Object.fromEntries(holidays(y).map((x) => [x.nome.split(" (")[0], x.dia]));
    expect(h(2025)["Sexta-feira da Paixão"]).toBe("2025-04-18");
    expect(h(2025)["Corpus Christi"]).toBe("2025-06-19");
    expect(h(2026)["Sexta-feira da Paixão"]).toBe("2026-04-03");
    expect(h(2026)["Corpus Christi"]).toBe("2026-06-04");
    expect(h(2027)["Sexta-feira da Paixão"]).toBe("2027-03-26");
  });

  it("inclui o estadual do Pará e o municipal de 8/12, sem pontos facultativos", () => {
    const dias = holidays(2026).map((x) => x.dia);
    expect(dias).toContain("2026-08-15");
    expect(dias).toContain("2026-12-08");
    expect(dias).toContain("2026-11-20");
    expect(dias).not.toContain("2026-01-12"); // aniversário de Belém (ponto facultativo)
    expect(dias).not.toContain("2026-02-16"); // carnaval
  });
});

describe("dias úteis", () => {
  it("segunda a sábado menos os feriados", () => {
    expect(workdaysOfMonth("2026-10", SEG_SAB).dias).toHaveLength(26);
    expect(workdaysOfMonth("2026-11", SEG_SAB).dias).toHaveLength(23);
    expect(workdaysOfMonth("2026-12", SEG_SAB).feriados.map((f) => f.dia)).toEqual(["2026-12-08", "2026-12-25"]);
  });

  it("ajustes: feriado criado, loja abre no feriado e domingo com expediente", () => {
    const base = workdaysOfMonth("2026-11", SEG_SAB).dias.length;
    const ajustes = [
      { dia: "2026-11-10", nome: "Loja fechada", fecha: true },
      { dia: "2026-11-20", nome: "Consciência Negra", fecha: false },
      { dia: "2026-11-29", nome: "Domingo especial", fecha: false },
    ];
    const r = workdaysOfMonth("2026-11", SEG_SAB, ajustes);
    expect(r.dias).not.toContain("2026-11-10");
    expect(r.dias).toContain("2026-11-20");
    expect(r.dias).toContain("2026-11-29");
    expect(r.dias).toHaveLength(base - 1 + 1 + 1);
    expect(effectiveHolidays(2026, ajustes).has("2026-11-20")).toBe(false);
  });
});

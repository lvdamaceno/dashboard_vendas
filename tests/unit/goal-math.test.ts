import { describe, expect, it } from "vitest";
import { goalMath } from "@/lib/goal-math";
import { workdaysOfMonth } from "@/lib/workdays";

// Outubro/2026 de segunda a sábado: 26 dias úteis (12/10 é feriado)
const outubro = workdaysOfMonth("2026-10", [1, 2, 3, 4, 5, 6]).dias;

describe("meta diária e saldo", () => {
  it("divide a meta pelos dias úteis", () => {
    const g = goalMath({ meta: 60000, realizado: 0, hoje: 0, diasUteis: outubro, today: "2026-10-01" });
    expect(outubro).toHaveLength(26);
    expect(g.base).toBeCloseTo(2307.69, 2);
    expect(g.metaHoje).toBeCloseTo(2307.69, 2);
    expect(g.saldo).toBe(0);
  });

  it("quem vendeu menos fica devendo e a meta de hoje sobe (exemplo do guia)", () => {
    // 23/10: 18 dias úteis antes; vendeu 41.250 no mês, 3.100 hoje
    const g = goalMath({ meta: 60000, realizado: 41250, hoje: 3100, diasUteis: outubro, today: "2026-10-23" });
    expect(g.saldo).toBeCloseTo(-3388.46, 2);
    expect(g.metaHoje).toBeCloseTo(5696.15, 2);
    expect(g.diasDepoisDeHoje).toBe(7);
  });

  it("quem vendeu mais tem saldo e a meta de hoje diminui, sem ficar negativa", () => {
    const g = goalMath({ meta: 60000, realizado: 52800, hoje: 0, diasUteis: outubro, today: "2026-10-23" });
    expect(g.saldo).toBeGreaterThan(g.base);
    expect(g.metaHoje).toBe(0);
  });

  it("folga não muda a conta: o dia sem venda vira dívida e a meta do dia seguinte dobra", () => {
    // Dia 1 (quinta) sem vender; no dia 2 a meta é base + o dia 1
    const g = goalMath({ meta: 60000, realizado: 0, hoje: 0, diasUteis: outubro, today: "2026-10-02" });
    expect(g.metaHoje).toBeCloseTo(2 * g.base, 6);
  });

  it("dia que não é útil não tem meta de hoje", () => {
    const g = goalMath({ meta: 60000, realizado: 1000, hoje: 1000, diasUteis: outubro, today: "2026-10-04" }); // domingo
    expect(g.metaHoje).toBeNull();
  });

  it("projeção pelo ritmo e quanto falta por dia", () => {
    const g = goalMath({ meta: 26000, realizado: 13000, hoje: 1000, diasUteis: outubro, today: "2026-10-15" });
    const decorridos = outubro.filter((d) => d <= "2026-10-15").length;
    expect(g.projecao).toBeCloseTo((13000 / decorridos) * 26, 6);
    expect(g.ritmoNecessario).toBeCloseTo(13000 / (26 - decorridos), 6);
  });

  it("meta batida: não há ritmo necessário", () => {
    const g = goalMath({ meta: 1000, realizado: 1500, hoje: 0, diasUteis: outubro, today: "2026-10-15" });
    expect(g.ritmoNecessario).toBeNull();
  });
});

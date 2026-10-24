import { describe, expect, it } from "vitest";
import { checkPlace, distanceM, nowInBrasilia, requirements, scheduleBlock, withinSchedule, type Janela, type Local } from "@/lib/acesso";

// Segunda a sexta 08:00–18:00, sábado 08:00–12:00, domingo fechado
const comercial = (d: number): Janela | null => (d === 0 ? null : d === 6 ? { inicio: "08:00", fim: "12:00" } : { inicio: "08:00", fim: "18:00" });
const janelas = Array.from({ length: 7 }, (_, d) => comercial(d));
const em = (dia: number, hhmm: string) => ({ dia, minutos: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });

describe("horário de acesso", () => {
  it("usa o horário de Brasília", () => {
    // 2026-10-26 (segunda) 10:30 UTC = 07:30 em Brasília
    expect(nowInBrasilia(new Date("2026-10-26T10:30:00Z"))).toEqual({ dia: 1, minutos: 7 * 60 + 30 });
    // 2026-10-26 01:00 UTC ainda é domingo à noite em Brasília
    expect(nowInBrasilia(new Date("2026-10-26T01:00:00Z"))).toEqual({ dia: 0, minutos: 22 * 60 });
  });

  it("início entra, fim não", () => {
    expect(withinSchedule(janelas, em(1, "08:00"))).toBe(true);
    expect(withinSchedule(janelas, em(1, "17:59"))).toBe(true);
    expect(withinSchedule(janelas, em(1, "18:00"))).toBe(false);
    expect(withinSchedule(janelas, em(1, "07:59"))).toBe(false);
    expect(withinSchedule(janelas, em(0, "10:00"))).toBe(false);
  });

  it("explica quando o painel abre", () => {
    expect(scheduleBlock(janelas, em(2, "10:00"))).toBeNull();
    expect(scheduleBlock(janelas, em(2, "06:00"))).toContain("Hoje o painel abre às 08:00");
    expect(scheduleBlock(janelas, em(2, "19:00"))).toContain("amanhã às 08:00");
    // Sábado à tarde: domingo fechado, abre segunda
    expect(scheduleBlock(janelas, em(6, "13:00"))).toContain("segunda às 08:00");
    // Só um dia na semana e já passou: na próxima semana
    const soSegunda = [null, { inicio: "09:00", fim: "10:00" }, null, null, null, null, null];
    expect(scheduleBlock(soSegunda, em(1, "11:00"))).toContain("na próxima segunda");
    expect(scheduleBlock(Array(7).fill(null), em(1, "11:00"))).toContain("fechado em todos os dias");
  });
});

describe("trava de local", () => {
  const loja: Local = { id: 1, nome: "Loja", endereco: null, lat: -1.4558, lng: -48.4902, raio: 150, ativo: true };
  // ~0,001° de latitude ≈ 111 m
  const norte = (m: number) => ({ lat: loja.lat + m / 111_195, lng: loja.lng });

  it("distância em metros", () => {
    expect(Math.round(distanceM(loja, norte(1000)))).toBe(1000);
  });

  it("dentro do raio libera; longe informa o local mais perto", () => {
    expect(checkPlace([loja], { ...norte(140), precisao: 10 })).toMatchObject({ ok: true, local: { id: 1 } });
    expect(checkPlace([loja], { ...norte(400), precisao: 10 })).toEqual({ ok: false, motivo: "longe", maisPerto: { nome: "Loja", distancia: 400 } });
  });

  it("a margem do GPS dá folga de no máximo 100 m", () => {
    expect(checkPlace([loja], { ...norte(200), precisao: 60 }).ok).toBe(true);
    expect(checkPlace([loja], { ...norte(300), precisao: 900 }).ok).toBe(false);
  });

  it("localização imprecisa demais é recusada, mesmo em cima da loja", () => {
    expect(checkPlace([loja], { ...norte(0), precisao: 5000 })).toEqual({ ok: false, motivo: "impreciso" });
  });

  it("local desativado não conta", () => {
    expect(checkPlace([{ ...loja, ativo: false }], { ...norte(0), precisao: 10 }).ok).toBe(false);
  });
});

describe("quem tem bloqueio", () => {
  it("diretoria (master) e admin nunca são bloqueados, nem consultam as regras", async () => {
    expect(await requirements("master")).toEqual({ horario: null, locais: null });
    expect(await requirements("admin")).toEqual({ horario: null, locais: null });
  });
});

// Dias úteis para as metas diárias (lojas em Belém do Pará).
//
// Feriados que fecham a conta (não são dia útil):
//  - nacionais (Lei 662/49, 6.802/80, 14.759/23 e Portaria MGI anual): 1/1, Sexta-feira da Paixão, 21/4, 1/5,
//    7/9, 12/10, 2/11, 15/11, 20/11 e 25/12;
//  - estadual do Pará: 15/8 (Adesão do Grão-Pará à Independência);
//  - municipais de Belém: Corpus Christi e 8/12 (Nossa Senhora da Conceição).
// Pontos facultativos (Carnaval, 12/1 aniversário de Belém, segunda do Círio, Recírio) não entram: o comércio abre.
// Dias da semana com expediente: META_DIAS_SEMANA (0 = domingo … 6 = sábado), padrão segunda a sábado.
// Master e admin ajustam por cima (painel.feriado): criam feriados novos, fazem a loja abrir num feriado do calendário
// ou marcam um dia fora do expediente normal (ex.: um domingo) como dia de expediente.

export interface Holiday {
  dia: string; // AAAA-MM-DD
  nome: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function holidays(year: number): Holiday[] {
  const pascoa = easter(year);
  const fixed: [string, string][] = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["08-15", "Adesão do Grão-Pará (feriado estadual)"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Consciência Negra"],
    ["12-08", "Nossa Senhora da Conceição (feriado municipal)"],
    ["12-25", "Natal"],
  ];
  return [
    ...fixed.map(([md, nome]) => ({ dia: `${year}-${md}`, nome })),
    { dia: iso(plusDays(pascoa, -2)), nome: "Sexta-feira da Paixão" },
    { dia: iso(plusDays(pascoa, 60)), nome: "Corpus Christi (feriado municipal)" },
  ].sort((x, y) => x.dia.localeCompare(y.dia));
}

/** Ajuste: fecha = true cria feriado; false faz o dia ser útil (feriado em que a loja abre, ou domingo com expediente). */
export interface HolidayAdjustment {
  dia: string;
  nome: string;
  fecha: boolean;
}

/** Feriados que valem no ano: o calendário calculado com os ajustes do admin aplicados. */
export function effectiveHolidays(year: number, ajustes: HolidayAdjustment[] = []) {
  const map = new Map(holidays(year).map((h) => [h.dia, h.nome]));
  for (const a of ajustes) {
    if (!a.dia.startsWith(`${year}-`)) continue;
    if (a.fecha) map.set(a.dia, a.nome);
    else map.delete(a.dia);
  }
  return map;
}

/** Dias úteis do mês (AAAA-MM) e os feriados que caíram em dia de expediente. */
export function workdaysOfMonth(mes: string, weekdays: number[], ajustes: HolidayAdjustment[] = []) {
  const [y, m] = mes.split("-").map(Number);
  const feriados = effectiveHolidays(y, ajustes);
  const abre = new Set(ajustes.filter((a) => !a.fecha).map((a) => a.dia));
  const dias: string[] = [];
  const feriadosNoMes: Holiday[] = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d = plusDays(d, 1)) {
    const dia = iso(d);
    // Dia marcado como de expediente (ex.: um domingo em que a loja abriu) conta mesmo fora dos dias da semana normais
    if (!weekdays.includes(d.getUTCDay()) && !abre.has(dia)) continue;
    const feriado = feriados.get(dia);
    if (feriado) feriadosNoMes.push({ dia, nome: feriado });
    else dias.push(dia);
  }
  return { dias, feriados: feriadosNoMes };
}

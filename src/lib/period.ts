export type Preset = "hoje" | "semana" | "mes" | "periodo";

export interface Period {
  preset: Preset;
  from: string; // AAAA-MM-DD (inclusivo)
  to: string; // AAAA-MM-DD (inclusivo)
  prevFrom: string;
  prevTo: string;
  label: string;
  prevLabel: string;
}

const TZ = "America/Sao_Paulo";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function addMonths(iso: string, months: number) {
  const d = toDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toIso(d);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;
}

const isValidIso = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && toIso(toDate(s)) === s;

export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const rangeLabel = (from: string, to: string) => (from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`);

export function resolvePeriod(params: { periodo?: string; de?: string; ate?: string }): Period {
  const today = todayIso();
  const preset = (["hoje", "semana", "mes", "periodo"] as const).find((p) => p === params.periodo) ?? "mes";

  let from: string;
  let to = today;
  let prevFrom: string;
  let prevTo: string;

  switch (preset) {
    case "hoje":
      from = today;
      prevFrom = prevTo = addDays(today, -1);
      break;
    case "semana": {
      // Semana atual completa, de segunda a sábado (no domingo, a semana que terminou ontem)
      const weekday = (toDate(today).getUTCDay() + 6) % 7; // segunda = 0
      from = addDays(today, -weekday);
      to = addDays(from, 5);
      // Comparação justa: semana anterior até o mesmo dia da semana de hoje
      prevFrom = addDays(from, -7);
      prevTo = addDays(today < to ? today : to, -7);
      break;
    }
    case "periodo": {
      const de = isValidIso(params.de) ? params.de : addDays(today, -29);
      const ate = isValidIso(params.ate) ? params.ate : today;
      [from, to] = de <= ate ? [de, ate] : [ate, de];
      if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
      const len = daysBetween(from, to);
      prevTo = addDays(from, -1);
      prevFrom = addDays(prevTo, -(len - 1));
      break;
    }
    default:
      // Mês atual completo, do primeiro ao último dia
      from = `${today.slice(0, 8)}01`;
      to = addDays(addMonths(from, 1), -1);
      // Comparação justa: mês anterior até o mesmo dia de hoje
      prevFrom = addMonths(from, -1);
      prevTo = addMonths(today, -1);
  }

  return {
    preset,
    from,
    to,
    prevFrom,
    prevTo,
    label: rangeLabel(from, to),
    prevLabel: rangeLabel(prevFrom, prevTo),
  };
}

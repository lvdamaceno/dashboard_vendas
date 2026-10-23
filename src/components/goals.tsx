import { money, percent } from "@/lib/format";
import type { GoalLine, GoalProgress } from "@/lib/goal-progress";

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

function Bar({ value, tone = "accent" }: { value: number; tone?: "accent" | "good" }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-alt">
      <div className={`h-full rounded-full ${tone === "good" ? "bg-good" : "bg-accent"}`} style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
    </div>
  );
}

function Saldo({ valor }: { valor: number }) {
  if (Math.abs(valor) < 0.5) return <span className="text-ink-3">em dia</span>;
  return valor > 0 ? <span className="text-good">+{money(valor)} de saldo</span> : <span className="text-bad">devendo {money(-valor)}</span>;
}

/** Meta do mês e meta de hoje (com saldo/dívida dos dias anteriores). */
export function GoalSummary({ progress }: { progress: GoalProgress }) {
  const { principal: p } = progress;
  const atingido = p.meta ? p.realizado / p.meta : 0;
  const bateuHoje = p.metaHoje !== null && p.hoje >= p.metaHoje;
  const mes = monthName.format(new Date(`${progress.mes}-01T00:00:00Z`));

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <div className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base">Meta de {mes}</h2>
          <span className="text-xs text-ink-3">
            {progress.diasUteis} dias úteis · {progress.restantes} {progress.restantes === 1 ? "restante" : "restantes"}
          </span>
        </div>
        <p className="tabular mt-2 font-title text-2xl font-semibold">
          {percent(atingido)} <span className="text-sm font-normal text-ink-3">de {money(p.meta)}</span>
        </p>
        <div className="mt-2 flex items-center">
          <Bar value={atingido} tone={atingido >= 1 ? "good" : "accent"} />
        </div>
        <p className="tabular mt-2 text-sm text-ink-2">
          {money(p.realizado)} vendidos · {p.realizado >= p.meta ? <span className="text-good">meta batida!</span> : <>faltam {money(p.meta - p.realizado)}</>}
        </p>
        <p className="tabular mt-1 text-xs text-ink-3">
          No ritmo atual o mês fecha em {money(p.projecao)} ({percent(p.meta ? p.projecao / p.meta : 0)} da meta)
        </p>
        {p.ritmoNecessario !== null && (
          <p className="tabular mt-1 text-xs text-ink-3">
            Para bater: {money(p.ritmoNecessario)} por dia útil nos {progress.diasDepoisDeHoje} dias úteis seguintes
          </p>
        )}
      </div>

      <div className={`rounded-3xl border p-5 ${bateuHoje ? "border-good/40 bg-good/5" : "border-line bg-surface"}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base">Meta de hoje</h2>
          <span className="tabular text-xs">
            <Saldo valor={p.saldo} />
          </span>
        </div>
        {p.metaHoje === null ? (
          <p className="mt-2 text-sm text-ink-2">Hoje não é dia útil: não há meta para hoje. Vendas de hoje contam como saldo.</p>
        ) : p.metaHoje === 0 ? (
          <>
            <p className="mt-2 font-title text-2xl font-semibold text-good">Coberta pelo saldo 🎉</p>
            <p className="tabular mt-2 text-sm text-ink-2">
              O que você vendeu a mais nos dias anteriores já cobre a meta de hoje. Tudo o que vender hoje aumenta o saldo.
            </p>
            <p className="tabular mt-1 text-xs text-ink-3">{money(p.hoje)} vendidos hoje</p>
          </>
        ) : (
          <>
            <p className="tabular mt-2 font-title text-2xl font-semibold">{money(p.metaHoje)}</p>
            <div className="mt-2 flex items-center">
              <Bar value={p.metaHoje ? p.hoje / p.metaHoje : 1} tone={bateuHoje ? "good" : "accent"} />
            </div>
            <p className="tabular mt-2 text-sm text-ink-2">
              {money(p.hoje)} vendidos hoje ·{" "}
              {bateuHoje ? <span className="text-good">meta de hoje batida!</span> : <>faltam {money(p.metaHoje - p.hoje)}</>}
            </p>
            <p className="tabular mt-1 text-xs text-ink-3">
              Base de {money(p.base)} por dia útil
              {Math.abs(p.saldo) >= 0.5 && (p.saldo > 0 ? ` − ${money(p.saldo)} de saldo` : ` + ${money(-p.saldo)} em atraso`)}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** Metas por vendedor (loja) ou por loja (todas as lojas). */
/** Vai fechar o mês? Projeção no ritmo atual comparada com a meta. */
function Ritmo({ l }: { l: GoalLine }) {
  if (l.realizado >= l.meta) return <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">meta batida</span>;
  return l.projecao >= l.meta ? (
    <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good">no ritmo</span>
  ) : (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-bad">abaixo do ritmo</span>
  );
}

export function GoalTable({ titulo, linhas, hojeUtil }: { titulo: string; linhas: GoalLine[]; hojeUtil: boolean }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-base">{titulo}</h2>
      <ul className="space-y-4">
        {linhas.map((l) => {
          const atingido = l.meta ? l.realizado / l.meta : 0;
          return (
            <li key={l.chave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium">{l.nome}</span>
                  {l.loja && <span className="shrink-0 text-xs text-ink-3">{l.loja}</span>}
                </span>
                <span className="tabular shrink-0">
                  {percent(atingido)} <span className="text-xs text-ink-3">de {money(l.meta)}</span>
                </span>
              </div>
              <div className="mt-1 flex items-center">
                <Bar value={atingido} tone={atingido >= 1 ? "good" : "accent"} />
              </div>
              <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                <Ritmo l={l} />
                <span>{money(l.realizado)} no mês</span>
                {hojeUtil && l.metaHoje !== null && (
                  <span className={l.hoje >= l.metaHoje ? "text-good" : ""}>
                    {l.metaHoje === 0 ? "hoje coberto pelo saldo" : `hoje ${money(l.hoje)} de ${money(l.metaHoje)}`}
                  </span>
                )}
                <Saldo valor={l.saldo} />
                <span>fecha em {money(l.projecao)}</span>
                {l.ritmoNecessario !== null && <span>precisa de {money(l.ritmoNecessario)}/dia</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Filters } from "@/components/filters";
import { KpiCard } from "@/components/kpi-card";
import { OrdersTable } from "@/components/orders-table";
import { pedidosLabel, RankList } from "@/components/rank-list";
import { SalesChart } from "@/components/sales-chart";
import { money, number } from "@/lib/format";
import { addDays, daysBetween, formatDay, resolvePeriod, todayIso } from "@/lib/period";
import { getDashboardData, getTeam, type DashboardData } from "@/lib/sales";
import { SankhyaError } from "@/lib/sankhya/client";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/logo";
import { logout } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const period = resolvePeriod({ periodo: one(sp.periodo), de: one(sp.de), ate: one(sp.ate) });
  const isManager = session.role === "gerente";
  const vendedorParam = Number(one(sp.vendedor));
  // Só gerentes filtram por vendedor; a restrição de loja/equipe continua valendo no SQL
  const vendedor = isManager && Number.isSafeInteger(vendedorParam) && vendedorParam > 0 ? vendedorParam : undefined;

  let data: DashboardData;
  let team: Awaited<ReturnType<typeof getTeam>>;
  try {
    [data, team] = await Promise.all([getDashboardData(session, period, vendedor), getTeam(session)]);
  } catch (err) {
    if (err instanceof SankhyaError && err.code === "SESSION_EXPIRED") redirect("/sessao-expirada");
    console.error("[dashboard]", err);
    return (
      <Shell session={session}>
        <div className="rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="font-medium">Não foi possível carregar as vendas</p>
          <p className="mt-1 text-sm text-ink-2">O Sankhya não respondeu como esperado. Tente novamente em instantes.</p>
        </div>
      </Shell>
    );
  }

  // Completa os dias sem venda para o gráfico não "pular" datas
  const byDay = new Map(data.diario.map((d) => [d.dia, d]));
  const series = Array.from({ length: daysBetween(period.from, period.to) }, (_, i) => {
    const dia = addDays(period.from, i);
    return byDay.get(dia) ?? { dia, total: 0, pedidos: 0 };
  });

  const linkFor = (codvend: number) => {
    const params = new URLSearchParams({ periodo: period.preset, vendedor: String(codvend) });
    if (period.preset === "periodo") {
      params.set("de", period.from);
      params.set("ate", period.to);
    }
    return `/dashboard?${params}`;
  };

  const { atual, anterior } = data;
  const vendedorNome = vendedor ? team.find((t) => t.codigo === vendedor)?.nome : undefined;

  return (
    <Shell session={session}>
      <Filters
        key={`${period.preset}-${period.from}-${period.to}-${vendedor ?? ""}`}
        preset={period.preset}
        from={period.from}
        to={period.to}
        today={todayIso()}
        vendedor={vendedor}
        team={team}
      />

      <p className="text-xs text-ink-3">
        {period.label}
        {vendedorNome && <> · {vendedorNome}</>}
        <span className="hidden sm:inline"> · comparado a {period.prevLabel}</span>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Faturamento líquido"
          value={money(atual.total)}
          current={atual.total}
          previous={anterior.total}
          prevLabel={period.prevLabel}
          note={atual.devolucoes > 0 ? `− ${money(atual.devolucoes)} em devoluções` : undefined}
        />
        <KpiCard label="Pedidos" value={number(atual.pedidos)} current={atual.pedidos} previous={anterior.pedidos} prevLabel={period.prevLabel} />
        <KpiCard label="Ticket médio" value={money(atual.ticket)} current={atual.ticket} previous={anterior.ticket} prevLabel={period.prevLabel} />
        <KpiCard label="Clientes" value={number(atual.clientes)} current={atual.clientes} previous={anterior.clientes} prevLabel={period.prevLabel} />
      </div>

      {series.length > 1 && (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-base">Faturamento por dia</h2>
          <SalesChart data={series} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer py-1 text-xs text-ink-3">Ver em tabela</summary>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {series.filter((d) => d.total !== 0 || d.pedidos > 0).map((d) => (
                  <tr key={d.dia} className="border-b border-line last:border-0">
                    <td className="tabular py-1.5 text-ink-2">{formatDay(d.dia)}</td>
                    <td className="tabular py-1.5 text-right text-ink-2">{pedidosLabel(d.pedidos)}</td>
                    <td className={`tabular py-1.5 text-right font-medium ${d.total < 0 ? "text-bad" : ""}`}>{money(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      {isManager && !vendedor && (
        <RankList
          title="Ranking de vendedores"
          items={data.vendedores.map((v) => ({
            key: v.codigo,
            nome: v.nome,
            total: v.total,
            detalhe: pedidosLabel(v.pedidos),
            href: linkFor(v.codigo),
          }))}
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <RankList
          title="Produtos mais vendidos"
          items={data.produtos.map((p) => ({ key: p.codigo, nome: p.nome, total: p.total, detalhe: `${number(p.quantidade)} un.` }))}
        />
        <RankList
          title="Principais clientes"
          items={data.clientes.map((c) => ({ key: c.codigo, nome: c.nome, total: c.total, detalhe: pedidosLabel(c.pedidos) }))}
        />
      </div>

      <OrdersTable pedidos={data.pedidos} showVendedor={isManager} />
    </Shell>
  );
}

function Shell({ session, children }: { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; children: React.ReactNode }) {
  const scope = session.role === "gerente" ? `Gerente · Loja ${session.codemp}` : `Vendedor · ${session.codvend}`;

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 bg-[#d71921] pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo variant="white" className="h-8 w-auto shrink-0 md:h-9" title="Casa Contente" />
          <div className="ml-auto min-w-0 text-right">
            <p className="truncate font-title text-sm font-medium">{session.apelido}</p>
            <p className="truncate text-xs text-white/80">{scope}</p>
          </div>
          <Link
            href="/ajuda"
            aria-label="Como usar o painel"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 font-title text-lg font-semibold hover:bg-white/25"
          >
            ?
          </Link>
          <form action={logout}>
            <button type="submit" className="h-10 rounded-full bg-white/15 px-4 font-title text-sm font-medium text-white hover:bg-white/25 active:bg-white/25">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-3 px-4 py-4 md:space-y-4 md:py-6">{children}</main>
    </div>
  );
}

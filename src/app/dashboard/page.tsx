import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Filters } from "@/components/filters";
import { GoalSummary, GoalTable } from "@/components/goals";
import { ServiceStatsSection } from "@/components/service-stats";
import { serviceStats, type ServiceStats } from "@/lib/atendimentos";
import { getGoalProgress, type GoalProgress } from "@/lib/goal-progress";
import { KpiCard } from "@/components/kpi-card";
import { LostClients } from "@/components/lost-clients";
import { OrdersTable } from "@/components/orders-table";
import { pedidosLabel, RankList } from "@/components/rank-list";
import { SalesChart } from "@/components/sales-chart";
import { VendorTable } from "@/components/vendor-table";
import { money, number, percent } from "@/lib/format";
import { getInsights, SUMIDO_COMPRAS, SUMIDO_DIAS, type InsightPromises, type VendorStats } from "@/lib/insights";
import { addDays, daysBetween, formatDay, resolvePeriod, todayIso } from "@/lib/period";
import { masterExists, listNotices, type Notice } from "@/lib/painel";
import { listPeopleForAdmin } from "@/lib/people";
import { getDashboardData, getStores, getTeam, netSales, type Person, type Summary } from "@/lib/sales";
import { SankhyaError } from "@/lib/sankhya/client";
import { getSession, isManagerial, seesAllStores, viewSession, type Session } from "@/lib/session";
import { OfflineBanner } from "@/components/offline-banner";
import { PersonPicker } from "@/components/person-picker";
import { PushToggle } from "@/components/push-toggle";
import { TeamPhones } from "@/components/phone-editor";
import { roleLabel, Shell } from "@/components/shell";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Master removido pelo admin perde o acesso na hora (se o banco não responder, segue)
  if (session.role === "master" && session.masterId) {
    const exists = await masterExists(session.masterId).catch((err) => {
      console.error("[dashboard] não foi possível conferir o master:", err instanceof Error ? err.message : err);
      return true;
    });
    if (!exists) redirect("/sessao-expirada");
  }

  const sp = await searchParams;
  const period = resolvePeriod({ periodo: one(sp.periodo), de: one(sp.de), ate: one(sp.ate) });
  const param = (k: string) => {
    const v = Number(one(sp[k]));
    return Number.isSafeInteger(v) && v > 0 ? v : undefined;
  };

  // Admin vendo o painel de alguém usa a sessão dessa pessoa; master e admin escolhem a loja na URL
  const base = viewSession(session);
  const allStores = seesAllStores(base);
  const loja = allStores ? param("loja") : undefined;
  const view: Session = allStores ? { ...base, codemp: loja ?? 0 } : base;
  const isManager = isManagerial(view);
  // Só quem vê a loja filtra por vendedor; a restrição de loja/equipe continua valendo no SQL
  const vendedor = isManager ? param("vendedor") : undefined;

  // Indicadores complementares: cada um chega por conta própria e aparece quando fica pronto
  // (Suspense), sem segurar o resto da tela
  const insights = getInsights(view, period, vendedor);
  // Atendimentos registrados pela fila no período (conversão e motivos de perda)
  const atendimentos = serviceStats(view, period.from, period.to, vendedor).catch((err): ServiceStats | null => {
    console.error("[atendimentos]", err instanceof Error ? err.message : err);
    return null;
  });
  // Diretoria e admin: o mesmo período do ano passado, para ver o crescimento. Só até a data de hoje:
  // o período "mês" vai até o fim do mês, e comparar com o mês inteiro do ano passado seria injusto
  const ateHoje = period.to > todayIso() ? todayIso() : period.to;
  const yoy = allStores
    ? netSales(view, lastYear(period.from), lastYear(ateHoje), vendedor).catch((err): number | null => {
        console.error("[dashboard] ano passado:", err instanceof Error ? err.message : err);
        return null;
      })
    : Promise.resolve(null);

  const storesP = isManagerial(session) ? optional("lojas", getStores) : Promise.resolve([]);
  // Metas do mês atual (independem do período escolhido); se falhar, o bloco não aparece
  const goals = storesP
    .then((lojas) => getGoalProgress(view, lojas, vendedor))
    .catch((err): GoalProgress | null => {
      console.error("[metas] andamento:", err instanceof Error ? err.message : err);
      return null;
    });

  // Avisos, lojas e vendas ao mesmo tempo (nada espera o outro)
  const [notices, stores, people, main] = await Promise.all([
    listNotices(session).catch((err): Notice[] | null => {
      console.error("[avisos] erro ao carregar:", err instanceof Error ? err.message : err);
      return null;
    }),
    storesP,
    session.role === "admin" && !session.como ? listPeopleForAdmin() : ([] as Person[]),
    Promise.all([getDashboardData(view, period, vendedor), getTeam(view, period, vendedor)]).then(
      ([data, team]) => ({ data, team }),
      (err: unknown) => ({ err }),
    ),
  ]);
  const shell = { session, notices, stores, scope: allStores ? roleLabel(view, stores.find((s) => s.codigo === loja)?.nome) : undefined };

  if ("err" in main) {
    const { err } = main;
    if (err instanceof SankhyaError && err.code === "SESSION_EXPIRED") redirect("/sessao-expirada");
    console.error("[dashboard]", err);
    return (
      <Shell {...shell}>
        <div className="rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="font-medium">Não foi possível carregar as vendas</p>
          <p className="mt-1 text-sm text-ink-2">O Sankhya não respondeu como esperado. Tente novamente em instantes.</p>
        </div>
      </Shell>
    );
  }
  const { data, team } = main;

  // Completa os dias sem venda para o gráfico não "pular" datas
  const byDay = new Map(data.diario.map((d) => [d.dia, d]));
  const series = Array.from({ length: daysBetween(period.from, period.to) }, (_, i) => {
    const dia = addDays(period.from, i);
    return byDay.get(dia) ?? { dia, total: 0, pedidos: 0 };
  });

  const linkFor = (filter: { vendedor?: number; loja?: number }) => {
    const params = new URLSearchParams({ periodo: period.preset });
    const lojaLink = filter.loja ?? loja;
    if (lojaLink) params.set("loja", String(lojaLink));
    if (filter.vendedor) params.set("vendedor", String(filter.vendedor));
    if (period.preset === "periodo") {
      params.set("de", period.from);
      params.set("ate", period.to);
    }
    return `/dashboard?${params}`;
  };

  const { atual, anterior } = data;
  const vendedorNome = vendedor ? team.find((t) => t.codigo === vendedor)?.nome : undefined;

  const showWeek = daysBetween(period.from, period.to) >= 7;

  return (
    <Shell {...shell}>
      {people.length > 0 && (
        <details className="group rounded-3xl border border-line bg-surface p-5">
          <summary className="cursor-pointer font-title font-medium">Ver o painel de um master, gerente ou vendedor</summary>
          <div className="mt-3">
            <PersonPicker people={people} stores={stores} />
          </div>
        </details>
      )}

      {session.role !== "admin" && <PushToggle banner />}

      <Filters
        key={`${period.preset}-${period.from}-${period.to}-${loja ?? ""}-${vendedor ?? ""}`}
        preset={period.preset}
        from={period.from}
        to={period.to}
        today={todayIso()}
        vendedor={vendedor}
        team={team}
        stores={allStores ? stores : []}
        loja={loja}
        showCard={session.role === "vendedor" || session.role === "gerente"}
        showGoals={session.role === "master" || (session.role === "admin" && !session.como)}
      />

      {/* data-offline-ok: o service worker só guarda para uso offline o painel que carregou */}
      <div className="space-y-1" data-offline-ok="">
        <p className="text-xs text-ink-3">
          {period.label}
          {vendedorNome && <> · {vendedorNome}</>}
          <span className="hidden sm:inline"> · comparado a {period.prevLabel}</span>
        </p>
        <OfflineBanner updatedAt={updatedAt.format(new Date())} />
      </div>

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

      <Suspense fallback={null}>
        <Await promise={goals}>{(g) => g && <GoalSummary progress={g} />}</Await>
      </Suspense>

      <Suspense fallback={<SkeletonRow />}>
        <SecondaryKpis insights={insights} atual={atual} anterior={anterior} prevLabel={period.prevLabel} yoy={yoy} ano={Number(period.from.slice(0, 4)) - 1} />
      </Suspense>

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

      {data.lojas.length > 0 && !vendedor && (
        <RankList
          title="Ranking de lojas"
          items={data.lojas.map((l) => ({
            key: l.codigo,
            nome: stores.find((s) => s.codigo === l.codigo)?.nome ?? `Loja ${l.codigo}`,
            total: l.total,
            detalhe: pedidosLabel(l.pedidos),
            href: linkFor({ loja: l.codigo }),
          }))}
        />
      )}

      {isManager && !vendedor && (
        <RankList
          title="Ranking de vendedores"
          items={data.vendedores.map((v) => ({
            key: v.codigo,
            nome: v.nome,
            total: v.total,
            detalhe: pedidosLabel(v.pedidos),
            href: linkFor({ vendedor: v.codigo }),
          }))}
        />
      )}

      <Suspense fallback={null}>
        <Await promise={goals}>
          {(g) => g?.detalhes.map((d) => <GoalTable key={d.titulo} titulo={d.titulo} linhas={d.linhas} hojeUtil={g.hojeUtil} />)}
        </Await>
      </Suspense>

      <Suspense fallback={null}>
        <Await promise={atendimentos}>
          {(a) =>
            a && (
              <ServiceStatsSection
                stats={a}
                agrupar={!isManager || vendedor ? "nenhum" : allStores && !loja ? "loja" : "vendedor"}
                lojas={stores}
                notas={{
                  total: data.atual.pedidos,
                  // Notas por vendedor (gerente) ou por loja (todas as lojas), do mesmo período
                  porChave: new Map(allStores && !loja ? data.lojas.map((l) => [l.codigo, l.pedidos]) : data.vendedores.map((v) => [v.codigo, v.pedidos])),
                }}
              />
            )
          }
        </Await>
      </Suspense>

      {isManager && !vendedor && (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <VendorStatsTable insights={insights} />
        </Suspense>
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

      <Suspense fallback={<Skeleton className="h-80" />}>
        <InsightLists insights={insights} showWeek={showWeek} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64" />}>
        <Await promise={insights.sumidos}>
          {(sumidos) =>
            sumidos && <LostClients key={`${loja ?? ""}-${vendedor ?? ""}`} clientes={sumidos} compras={SUMIDO_COMPRAS} dias={SUMIDO_DIAS} />
          }
        </Await>
      </Suspense>

      <OrdersTable pedidos={data.pedidos} showVendedor={isManager} />

      {/* Não é indicador: fica no fim. Só o gerente de verdade (o admin edita todos na área de admin) */}
      {session.role === "gerente" && <TeamPhones />}
    </Shell>
  );
}

const updatedAt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Consulta complementar: se falhar, a tela segue sem ela. */
async function optional<T>(name: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[dashboard] ${name}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

const skeleton = "animate-pulse rounded-3xl border border-line bg-surface";
const Skeleton = ({ className }: { className: string }) => <div className={`${skeleton} ${className}`} />;
const SkeletonRow = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className={`${skeleton} h-24`} />
    ))}
  </div>
);

/** Espera uma promessa dentro de um Suspense e entrega o valor para o conteúdo. */
async function Await<T>({ promise, children }: { promise: Promise<T>; children: (value: T) => React.ReactNode }) {
  return children(await promise);
}

/** Mesma data um ano antes (29/02 vira 28/02). */
function lastYear(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y - 1, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

const devolucao = (x: Summary) => (x.total + x.devolucoes ? x.devolucoes / (x.total + x.devolucoes) : 0);

/** Segunda linha de indicadores (peças, desconto, devolução, clientes novos e margem). */
async function SecondaryKpis({
  insights,
  atual,
  anterior,
  prevLabel,
  yoy,
  ano,
}: {
  insights: InsightPromises;
  atual: Summary;
  anterior: Summary;
  prevLabel: string;
  /** faturamento líquido do mesmo período do ano passado (só diretoria e admin) */
  yoy: Promise<number | null>;
  ano: number;
}) {
  const [vendedores, clientes, margem, anoPassado] = await Promise.all([insights.vendedores, insights.clientes, insights.margem, yoy]);
  // Cada indicador some sozinho se a consulta dele falhar
  const itens = vendedores && { atual: totals(vendedores.atual), anterior: totals(vendedores.anterior) };
  const margemPct = (m: NonNullable<typeof margem>["atual"]) => (m.receita ? (m.receita - m.custo) / m.receita : 0);

  return (
    // Quantidade varia: dividem a linha por igual, 2 por linha no celular
    <div className="flex flex-wrap gap-3 *:min-w-0 *:flex-1 *:basis-[calc(50%-0.375rem)] lg:flex-nowrap lg:*:basis-0">
      {itens && (
        <>
          <KpiCard
            label="Peças por atendimento"
            value={number(Math.round(itens.atual.pecasPorPedido * 10) / 10)}
            current={itens.atual.pecasPorPedido}
            previous={itens.anterior.pecasPorPedido}
            prevLabel={prevLabel}
          />
          <KpiCard
            label="Desconto médio"
            value={percent(itens.atual.desconto)}
            current={itens.atual.desconto}
            previous={itens.anterior.desconto}
            prevLabel={prevLabel}
            note={itens.atual.descontoValor > 0 ? `${money(itens.atual.descontoValor)} em descontos` : undefined}
            noteTone="neutral"
            lowerIsBetter
          />
        </>
      )}
      <KpiCard
        label="Taxa de devolução"
        value={percent(devolucao(atual))}
        current={devolucao(atual)}
        previous={devolucao(anterior)}
        prevLabel={prevLabel}
        note={atual.devolucoes > 0 ? `${money(atual.devolucoes)} devolvidos` : undefined}
        noteTone="neutral"
        lowerIsBetter
      />
      {clientes && (
        <KpiCard
          label="Clientes novos"
          value={number(clientes.novos)}
          current={clientes.novos}
          prevLabel={prevLabel}
          note={`${number(clientes.total - clientes.novos)} já compravam antes`}
          noteTone="neutral"
        />
      )}
      {anoPassado !== null && (
        <KpiCard
          label={`Crescimento vs ${ano}`}
          value={anoPassado ? `${atual.total >= anoPassado ? "+" : ""}${percent((atual.total - anoPassado) / Math.abs(anoPassado))}` : "—"}
          current={atual.total}
          prevLabel={`o mesmo período de ${ano}`}
          note={`${money(anoPassado)} no mesmo período de ${ano}`}
          noteTone="neutral"
        />
      )}
      {margem && (
        <KpiCard
          label="Margem bruta"
          value={percent(margemPct(margem.atual))}
          current={margemPct(margem.atual)}
          previous={margemPct(margem.anterior)}
          prevLabel={prevLabel}
          note={
            margem.atual.cobertura < 0.95 && margem.atual.receita > 0
              ? `sem custo cadastrado em ${percent(1 - margem.atual.cobertura)} das vendas`
              : `${money(margem.atual.receita - margem.atual.custo)} de lucro bruto`
          }
          noteTone="neutral"
        />
      )}
    </div>
  );
}

/** Indicadores por vendedor (gerente): só vendedores ativos no TGFVEN. */
async function VendorStatsTable({ insights }: { insights: InsightPromises }) {
  const vendedores = await insights.vendedores;
  return vendedores && <VendorTable vendedores={vendedores.atual.filter((v) => v.ativo)} />;
}

async function InsightLists({ insights, showWeek }: { insights: InsightPromises; showWeek: boolean }) {
  const [categorias, devolvidos, semana, horas] = await Promise.all([insights.categorias, insights.devolvidos, insights.semana, insights.horas]);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {categorias && (
        <RankList
          title="Vendas por categoria"
          items={categorias.map((c) => ({ key: c.codigo, nome: c.nome || "Sem categoria", total: c.total, detalhe: `${number(c.quantidade)} un.` }))}
        />
      )}
      {devolvidos && (
        <RankList
          title="Produtos mais devolvidos"
          empty="Sem devoluções no período"
          items={devolvidos.map((p) => ({ key: p.codigo, nome: p.nome, total: p.total, detalhe: `${number(p.quantidade)} un.` }))}
        />
      )}
      {showWeek && semana && (
        <RankList
          title="Vendas por dia da semana"
          items={semana.map((d) => ({ key: d.dia, nome: WEEKDAYS[d.dia], total: d.total, detalhe: pedidosLabel(d.pedidos) }))}
        />
      )}
      {horas && (
        <RankList
          title="Vendas por horário"
          items={horas.map((h) => ({ key: h.hora, nome: `${String(h.hora).padStart(2, "0")}h às ${String(h.hora + 1).padStart(2, "0")}h`, total: h.total, detalhe: pedidosLabel(h.pedidos) }))}
        />
      )}
    </div>
  );
}

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Soma os vendedores: peças por atendimento e desconto médio do escopo inteiro. */
function totals(rows: VendorStats[]) {
  const sum = (k: keyof VendorStats) => rows.reduce((acc, r) => acc + Number(r[k]), 0);
  const pedidos = sum("pedidos");
  const bruto = sum("bruto");
  const descontoValor = sum("desconto");
  return { pecasPorPedido: pedidos ? sum("pecas") / pedidos : 0, desconto: bruto ? descontoValor / bruto : 0, descontoValor };
}

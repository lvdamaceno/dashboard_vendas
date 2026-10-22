import { money } from "@/lib/format";
import { formatDay } from "@/lib/period";
import type { DashboardData } from "@/lib/sales";

export function OrdersTable({ pedidos, showVendedor }: { pedidos: DashboardData["pedidos"]; showVendedor: boolean }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="px-4 pt-4 pb-3 text-sm font-medium">Últimas vendas e devoluções</h2>
      {pedidos.length === 0 ? (
        <p className="px-4 pb-8 pt-4 text-center text-sm text-ink-3">Sem vendas no período</p>
      ) : (
        <>
          {/* Celular: lista em cards */}
          <ul className="divide-y divide-line border-t border-line md:hidden">
            {pedidos.map((p) => (
              <li key={p.nunota} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {p.devolucao && <DevolucaoBadge />}
                    {p.cliente || "—"}
                  </p>
                  <p className="tabular mt-0.5 truncate text-xs text-ink-3">
                    {p.dia ? formatDay(p.dia) : "—"} · Nota {p.numnota || p.nunota}
                    {showVendedor && p.vendedor ? ` · ${p.vendedor}` : ""}
                  </p>
                </div>
                <span className={`tabular shrink-0 text-sm font-medium ${p.devolucao ? "text-bad" : ""}`}>{money(p.total)}</span>
              </li>
            ))}
          </ul>

          {/* Tablet/desktop: tabela */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-y border-line text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-normal">Data</th>
                <th className="px-4 py-2 font-normal">Nota</th>
                <th className="px-4 py-2 font-normal">Cliente</th>
                {showVendedor && <th className="px-4 py-2 font-normal">Vendedor</th>}
                <th className="px-4 py-2 text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.nunota} className="border-b border-line last:border-0">
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-ink-2">{p.dia ? formatDay(p.dia) : "—"}</td>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-ink-2">{p.numnota || p.nunota}</td>
                  <td className="max-w-64 truncate px-4 py-2.5" title={p.cliente}>
                    {p.devolucao && <DevolucaoBadge />}
                    {p.cliente || "—"}
                  </td>
                  {showVendedor && <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{p.vendedor}</td>}
                  <td className={`tabular whitespace-nowrap px-4 py-2.5 text-right font-medium ${p.devolucao ? "text-bad" : ""}`}>
                    {money(p.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function DevolucaoBadge() {
  return <span className="mr-1.5 rounded bg-bad/10 px-1.5 py-0.5 align-[1px] text-[11px] font-medium text-bad">Devolução</span>;
}

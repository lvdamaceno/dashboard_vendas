import { number, percent } from "@/lib/format";
import type { VendorStats } from "@/lib/insights";

const pecas = (v: VendorStats) => (v.pedidos ? v.pecas / v.pedidos : 0);
const desconto = (v: VendorStats) => (v.bruto ? v.desconto / v.bruto : 0);
const devolucao = (v: VendorStats) => {
  const liquido = v.bruto - v.desconto;
  return liquido ? v.devolvido / liquido : 0;
};

/** Peças por atendimento, desconto e devolução de cada vendedor da loja (só gerente). */
export function VendorTable({ vendedores }: { vendedores: VendorStats[] }) {
  const rows = vendedores.filter((v) => v.pedidos > 0 || v.devolvido > 0).sort((a, b) => b.bruto - b.desconto - (a.bruto - a.desconto));
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <h2 className="px-5 pt-5 pb-3 text-base">Indicadores por vendedor</h2>
      {rows.length === 0 ? (
        <p className="px-4 pb-8 pt-4 text-center text-sm text-ink-3">Sem vendas no período</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs text-ink-3">
              <th className="px-5 py-2 font-normal">Vendedor</th>
              <th className="px-2 py-2 text-right font-normal">
                Peças<span className="hidden sm:inline"> por atendimento</span>
              </th>
              <th className="px-2 py-2 text-right font-normal">Desconto</th>
              <th className="px-5 py-2 text-right font-normal">Devolução</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.codigo} className="border-b border-line last:border-0">
                <td className="max-w-32 truncate px-5 py-2.5 sm:max-w-64" title={v.nome}>
                  {v.nome}
                </td>
                <td className="tabular px-2 py-2.5 text-right">{number(Math.round(pecas(v) * 10) / 10)}</td>
                <td className="tabular px-2 py-2.5 text-right">{percent(desconto(v))}</td>
                <td className={`tabular px-5 py-2.5 text-right ${devolucao(v) > 0 ? "text-bad" : ""}`}>{percent(devolucao(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

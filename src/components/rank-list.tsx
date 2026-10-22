import Link from "next/link";
import { money, number } from "@/lib/format";

interface Item {
  key: number;
  nome: string;
  total: number;
  detalhe: string;
  href?: string;
}

export function RankList({ title, items, empty = "Sem vendas no período" }: { title: string; items: Item[]; empty?: string }) {
  const max = Math.max(...items.map((i) => i.total), 0);
  return (
    <section className="min-w-0 rounded-3xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-base">{title}</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => {
            const name = (
              <span className="truncate" title={item.nome}>
                {item.nome}
              </span>
            );
            return (
              <li key={item.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  {item.href ? (
                    <Link href={item.href} scroll={false} className="-my-2 min-w-0 truncate py-2 text-accent">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                  <span className={`tabular shrink-0 font-medium ${item.total < 0 ? "text-bad" : ""}`}>{money(item.total)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-alt">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${max ? (Math.max(item.total, 0) / max) * 100 : 0}%` }} />
                  </div>
                  <span className="tabular w-20 shrink-0 text-right text-xs text-ink-3">{item.detalhe}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export const pedidosLabel = (n: number) => `${number(n)} ${n === 1 ? "pedido" : "pedidos"}`;

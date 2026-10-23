import { money } from "@/lib/format";
import { SUMIDO_COMPRAS, SUMIDO_DIAS, type Insights } from "@/lib/insights";
import { formatDay } from "@/lib/period";

type Cliente = NonNullable<Insights["sumidos"]>[number];

const WhatsIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
  </svg>
);

/** Clientes frequentes que pararam de comprar, com atalho para chamar no WhatsApp. */
export function LostClients({ clientes }: { clientes: Cliente[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base">Clientes para chamar de volta</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Compraram {SUMIDO_COMPRAS} vezes ou mais no último ano e não voltam há mais de {SUMIDO_DIAS} dias
        </p>
      </div>
      {clientes.length === 0 ? (
        <p className="px-4 pb-8 pt-4 text-center text-sm text-ink-3">Nenhum cliente frequente sumido</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {clientes.map((c) => (
            <li key={c.codigo} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm" title={c.nome}>
                  {c.nome}
                </p>
                <p className="tabular mt-0.5 text-xs text-ink-3">
                  Última compra {formatDay(c.ultima)} · <span className="whitespace-nowrap">{c.compras} compras · {money(c.total)}</span>
                </p>
              </div>
              {c.telefone ? (
                <a
                  href={`https://wa.me/55${c.telefone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Chamar ${c.nome} no WhatsApp`}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#1f8f4e] px-3 font-title text-sm font-medium text-white hover:bg-[#187540]"
                >
                  <WhatsIcon />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              ) : (
                <span className="shrink-0 text-xs text-ink-3">sem celular</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

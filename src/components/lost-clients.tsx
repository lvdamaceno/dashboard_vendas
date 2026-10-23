"use client";

import { useState, useTransition } from "react";
import { dismissLostClient } from "@/app/painel-actions";
import { money } from "@/lib/format";
import type { Insights } from "@/lib/insights";
import { formatDay } from "@/lib/period";

type Cliente = NonNullable<Insights["sumidos"]>[number];

const PAGE = 10;

const WhatsIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
  </svg>
);

/** Clientes frequentes que pararam de comprar, com atalho para chamar no WhatsApp; 10 por página. */
export function LostClients({ clientes, compras, dias }: { clientes: Cliente[]; compras: number; dias: number }) {
  const [removed, setRemoved] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const list = clientes.filter((c) => !removed.includes(c.codigo));
  const pages = Math.ceil(list.length / PAGE);
  const [wanted, setPage] = useState(0);
  // Ao tirar o último cliente da última página, volta uma página
  const page = Math.min(wanted, Math.max(pages - 1, 0));
  const visible = list.slice(page * PAGE, (page + 1) * PAGE);

  function dismiss(c: Cliente) {
    if (!confirm(`Tirar ${c.nome} da lista?\n\nUse quando o cliente não quer voltar. Se ele comprar de novo, volta a aparecer aqui.`)) return;
    setError(undefined);
    setRemoved((r) => [...r, c.codigo]);
    startTransition(async () => {
      const res = await dismissLostClient(c.codigo);
      if (res.error) {
        setRemoved((r) => r.filter((x) => x !== c.codigo));
        setError(res.error);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base">Clientes para chamar de volta</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Compraram {compras} vezes ou mais no último ano e não voltam há mais de {dias} dias
        </p>
      </div>
      {error && (
        <p role="alert" className="px-5 pb-3 text-sm text-bad">
          {error}
        </p>
      )}
      {list.length === 0 ? (
        <p className="px-4 pb-8 pt-4 text-center text-sm text-ink-3">Nenhum cliente frequente sumido</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {visible.map((c) => (
            <li key={c.codigo} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm" title={c.nome}>
                  {c.nome}
                </p>
                <p className="tabular mt-0.5 text-xs text-ink-3">
                  Última compra {formatDay(c.ultima)} · <span className="whitespace-nowrap">{c.compras} compras · {money(c.total)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
                <button
                  type="button"
                  onClick={() => dismiss(c)}
                  aria-label={`Tirar ${c.nome} da lista`}
                  title="Tirar da lista"
                  className="flex size-9 items-center justify-center rounded-full text-ink-3 hover:bg-bg-alt hover:text-bad"
                >
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="m5.5 5.5 9 9m0-9-9 9" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-3" aria-label="Páginas de clientes">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="h-9 rounded-full border border-line px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <span className="tabular text-xs text-ink-3">
            {page * PAGE + 1}–{page * PAGE + visible.length} de {list.length}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pages - 1}
            className="h-9 rounded-full border border-line px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt disabled:opacity-40"
          >
            Próxima ›
          </button>
        </nav>
      )}
    </section>
  );
}

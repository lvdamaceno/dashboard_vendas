"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Resposta {
  total: number;
  itens: { codigo: number; descricao: string; desconto: number }[];
}

/** Espera a pessoa parar de digitar antes de consultar */
const ESPERA_MS = 250;

export function BlackFridaySearch() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [resposta, setResposta] = useState<{ termo: string; dados?: Resposta; erro?: string }>();
  const termo = busca.trim();
  const curto = termo.length < 2;

  useEffect(() => {
    if (curto) return;
    const pedido = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/black-friday?${new URLSearchParams({ q: termo })}`, { cache: "no-store", signal: pedido.signal });
        if (res.status === 401) return router.refresh();
        const corpo = await res.json();
        setResposta(res.ok ? { termo, dados: corpo } : { termo, erro: corpo.error });
      } catch {
        if (!pedido.signal.aborted) setResposta({ termo, erro: "Sem conexão. Confira a internet e tente de novo." });
      }
    }, ESPERA_MS);
    return () => {
      clearTimeout(timer);
      pedido.abort();
    };
  }, [termo, curto, router]);

  // Só mostra a resposta do que está digitado agora, nunca a de uma busca anterior
  const atual = !curto && resposta?.termo === termo ? resposta : undefined;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base">Desconto Black Friday</h2>
      <label htmlFor="busca-bf" className="mt-1 block text-sm text-ink-2">
        Digite o código ou a descrição do produto
      </label>
      <input
        id="busca-bf"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Ex.: 436423 ou tigela oxford"
        className="mt-3 h-11 w-full min-w-0 rounded-full border border-line bg-surface px-4 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
      />
      <div aria-live="polite">
        {atual?.erro && <p className="mt-3 text-sm text-bad">{atual.erro}</p>}
        {atual?.dados?.total === 0 && <p className="mt-3 text-sm text-ink-2">Nenhum produto com esse código ou descrição na lista da Black Friday.</p>}
        {!!atual?.dados?.total && (
          <>
            <ul className="mt-3 divide-y divide-line">
              {atual.dados.itens.map((p) => (
                <li key={p.codigo} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.descricao}</p>
                    <p className="tabular text-xs text-ink-3">Cód. {p.codigo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular font-title text-xl font-semibold text-accent">{p.desconto}%</p>
                    <p className="text-xs text-ink-3">à vista</p>
                  </div>
                </li>
              ))}
            </ul>
            {atual.dados.total > atual.dados.itens.length && (
              <p className="mt-2 text-xs text-ink-3">
                Mostrando {atual.dados.itens.length} de {atual.dados.total}. Digite mais para achar o produto.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

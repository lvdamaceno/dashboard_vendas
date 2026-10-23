"use client";

import { useActionState, useState } from "react";
import { money } from "@/lib/format";
import { formatMoneyInput, parseMoney } from "@/lib/money-input";
import { saveGoalsAction, type GoalsState } from "./actions";

interface Loja {
  codigo: number;
  nome: string;
  loja: number | null;
  vendedor: number | null;
  /** Candidatos: quem vendeu na loja nos últimos 90 dias e quem já está marcado */
  pessoas: { codvend: number; nome: string; notas: number; outraLoja: boolean }[];
  /** Pessoas consideradas na meta individual */
  marcados: number[];
}

const input =
  "tabular h-11 w-full rounded-full border border-line bg-bg pr-4 pl-10 text-right text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm";

function MoneyField({ name, label, defaultValue, onValue }: { name: string; label: string; defaultValue: number | null; onValue: (v: number | null) => void }) {
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-ink-3">R$</span>
      <input
        name={name}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        defaultValue={formatMoneyInput(defaultValue)}
        onChange={(e) => onValue(parseMoney(e.target.value))}
        // Ao sair do campo, mostra o valor já formatado (ex.: 150000 → 150.000,00)
        onBlur={(e) => {
          const v = parseMoney(e.target.value);
          if (v !== null && !Number.isNaN(v)) e.target.value = formatMoneyInput(v);
        }}
        className={input}
      />
    </div>
  );
}

const ok = (v: number | null | undefined): v is number => typeof v === "number" && !Number.isNaN(v) && v > 0;

function StoreRow({ loja, diasUteis }: { loja: Loja; diasUteis: number }) {
  const [metaLoja, setMetaLoja] = useState(loja.loja);
  const [porVendedor, setPorVendedor] = useState(loja.vendedor);
  const [marcados, setMarcados] = useState(loja.marcados);
  const equipe = ok(porVendedor) ? porVendedor * marcados.length : 0;

  return (
    <li className="space-y-3 px-4 py-4">
      <input type="hidden" name={`pessoas_${loja.codigo}`} value="1" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-title font-medium">{loja.nome}</p>
        <p className="text-xs text-ink-3">
          {marcados.length} {marcados.length === 1 ? "pessoa considerada" : "pessoas consideradas"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-ink-2">Meta da loja</span>
          <MoneyField name={`loja_${loja.codigo}`} label={`Meta da loja ${loja.nome}`} defaultValue={loja.loja} onValue={setMetaLoja} />
          {ok(metaLoja) && diasUteis > 0 && <span className="tabular block text-right text-xs text-ink-3">≈ {money(metaLoja / diasUteis)} por dia útil</span>}
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-ink-2">Meta por vendedor (cada um)</span>
          <MoneyField name={`vendedor_${loja.codigo}`} label={`Meta por vendedor em ${loja.nome}`} defaultValue={loja.vendedor} onValue={setPorVendedor} />
          {ok(porVendedor) && diasUteis > 0 && (
            <span className="tabular block text-right text-xs text-ink-3">≈ {money(porVendedor / diasUteis)} por dia útil</span>
          )}
        </label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs text-ink-2">Pessoas consideradas na meta individual</legend>
        {loja.pessoas.length === 0 ? (
          <p className="text-xs text-ink-3">Ninguém vendeu nesta loja nos últimos 90 dias.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {loja.pessoas.map((p) => (
              <label
                key={p.codvend}
                title={`${p.notas} vendas nesta loja nos últimos 90 dias${p.outraLoja ? " · marcado em outra loja" : ""}`}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
              >
                <input
                  type="checkbox"
                  name={`pessoa_${loja.codigo}`}
                  value={p.codvend}
                  checked={marcados.includes(p.codvend)}
                  onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, p.codvend] : m.filter((x) => x !== p.codvend)))}
                  className="accent-[var(--accent)]"
                />
                {p.nome}
                <span className="tabular text-xs text-ink-3">{p.notas}</span>
                {p.outraLoja && <span className="text-xs text-bad">· outra loja</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      {ok(porVendedor) && marcados.length > 0 && (
        <p className="tabular text-xs text-ink-3">
          {marcados.length} × {money(porVendedor)} = <span className="font-medium text-ink">{money(equipe)}</span>
          {ok(metaLoja) && Math.abs(equipe - metaLoja) >= 0.01 && (
            <span className={equipe < metaLoja ? "text-bad" : "text-good"}>
              {" "}
              ({equipe < metaLoja ? "faltam" : "passam"} {money(Math.abs(equipe - metaLoja))} da meta da loja)
            </span>
          )}
        </p>
      )}
    </li>
  );
}

export function GoalsForm({ mes, diasUteis, lojas }: { mes: string; diasUteis: number; lojas: Loja[] }) {
  const [state, action, pending] = useActionState<GoalsState, FormData>(saveGoalsAction, {});

  if (!lojas.length) return <p className="py-6 text-center text-sm text-ink-3">Nenhuma loja encontrada.</p>;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mes" value={mes} />
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {lojas.map((l) => (
          <StoreRow key={l.codigo} loja={l} diasUteis={diasUteis} />
        ))}
      </ul>
      <p className="text-xs text-ink-3">
        A meta por vendedor vale igual para cada pessoa marcada na loja (o número ao lado do nome é quantas vendas ela fez ali nos
        últimos 90 dias). Cada pessoa conta em uma loja só. Deixe o valor em branco para não ter meta.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      {state.ok && !pending && <p className="text-sm text-good">Metas salvas.</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-accent px-6 font-title text-base font-medium text-white hover:bg-accent-dark disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Salvando…" : "Salvar metas"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { money } from "@/lib/format";
import { formatMoneyInput, parseMoney } from "@/lib/money-input";
import { saveGoalsAction, type GoalsState } from "./actions";

interface Props {
  loja: number;
  mes: string;
  metaLoja: number | null;
  diasUteis: number;
  vendedores: { codvend: number; nome: string; role: "vendedor" | "gerente"; meta: number | null }[];
}

const input =
  "tabular h-11 w-full rounded-full border border-line bg-bg pr-4 pl-10 text-right text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm";

function PerDay({ valor, dias }: { valor: number | null; dias: number }) {
  if (!valor || Number.isNaN(valor) || !dias) return null;
  return <p className="tabular mt-1 text-right text-xs text-ink-3">≈ {money(valor / dias)} por dia útil</p>;
}

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

export function GoalsForm({ loja, mes, metaLoja, diasUteis, vendedores }: Props) {
  const [state, action, pending] = useActionState<GoalsState, FormData>(saveGoalsAction, {});
  const [loja$, setLoja] = useState(metaLoja);
  const [individuais, setIndividuais] = useState<Record<number, number | null>>(Object.fromEntries(vendedores.map((v) => [v.codvend, v.meta])));
  const soma = Object.values(individuais).reduce<number>((acc, v) => acc + (v && !Number.isNaN(v) ? v : 0), 0);
  const diferenca = loja$ && !Number.isNaN(loja$) ? soma - loja$ : null;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="loja" value={loja} />
      <input type="hidden" name="mes" value={mes} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-base">Meta geral da loja</h2>
          <p className="text-sm text-ink-3">Faturamento líquido esperado da loja no mês</p>
        </div>
        <div className="w-full sm:w-48">
          <MoneyField name="meta_loja" label="Meta geral da loja" defaultValue={metaLoja} onValue={setLoja} />
          <PerDay valor={loja$} dias={diasUteis} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">Metas individuais</h2>
          <p className="tabular text-sm text-ink-3">
            Soma: <span className="font-medium text-ink">{money(soma)}</span>
            {diferenca !== null && diferenca !== 0 && (
              <span className={diferenca < 0 ? "text-bad" : "text-good"}>
                {" "}
                ({diferenca < 0 ? "faltam" : "passam"} {money(Math.abs(diferenca))} da meta da loja)
              </span>
            )}
          </p>
        </div>
        {vendedores.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">Nenhum vendedor ativo nesta loja.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {vendedores.map((v) => (
              <li key={v.codvend} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{v.nome}</p>
                  <p className="text-xs text-ink-3">{v.role === "gerente" ? "Gerente" : "Vendedor"}</p>
                </div>
                <div className="w-full sm:w-48">
                  <MoneyField
                    name={`meta_${v.codvend}`}
                    label={`Meta de ${v.nome}`}
                    defaultValue={v.meta}
                    onValue={(valor) => setIndividuais((m) => ({ ...m, [v.codvend]: valor }))}
                  />
                  <PerDay valor={individuais[v.codvend] ?? null} dias={diasUteis} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-3">Deixe em branco para não ter meta. Apagar o valor e salvar remove a meta.</p>
      </div>

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

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Preset } from "@/lib/period";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "periodo", label: "Período" },
];

interface Props {
  preset: Preset;
  from: string;
  to: string;
  today: string;
  vendedor?: number;
  team: { codigo: number; nome: string }[];
}

// Alvos de toque de 44px no celular; um pouco mais compactos a partir do tablet
const control =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm";

export function Filters({ preset, from, to, today, vendedor, team }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState(preset === "periodo");
  const [de, setDe] = useState(from);
  const [ate, setAte] = useState(to);

  function navigate(next: { periodo: Preset; de?: string; ate?: string; vendedor?: number }) {
    const params = new URLSearchParams({ periodo: next.periodo });
    if (next.periodo === "periodo" && next.de && next.ate) {
      params.set("de", next.de);
      params.set("ate", next.ate);
    }
    if (next.vendedor) params.set("vendedor", String(next.vendedor));
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  const current = { periodo: preset, de: from, ate: to, vendedor };

  return (
    <div className="space-y-2 md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0" aria-busy={pending}>
      <div className="grid grid-cols-4 rounded-xl border border-line bg-surface p-1 md:inline-grid md:w-auto" role="tablist" aria-label="Período">
        {PRESETS.map((p) => {
          const active = custom ? p.value === "periodo" : p.value === preset;
          return (
            <button
              key={p.value}
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (p.value === "periodo") return setCustom(true);
                setCustom(false);
                navigate({ ...current, periodo: p.value });
              }}
              className={`h-10 rounded-lg px-3 text-sm transition md:h-8 ${
                active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 active:bg-bg"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {custom && (
        <form
          className="grid grid-cols-2 gap-2 md:flex md:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ ...current, periodo: "periodo", de, ate });
          }}
        >
          <input type="date" aria-label="Data inicial" value={de} max={today} onChange={(e) => setDe(e.target.value)} className={control} required />
          <input type="date" aria-label="Data final" value={ate} min={de} max={today} onChange={(e) => setAte(e.target.value)} className={control} required />
          <button
            type="submit"
            className="col-span-2 h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white active:opacity-80 md:h-10"
          >
            Aplicar período
          </button>
        </form>
      )}

      {team.length > 0 && (
        <select
          aria-label="Vendedor"
          value={vendedor ?? ""}
          onChange={(e) => navigate({ ...current, vendedor: Number(e.target.value) || undefined })}
          className={`${control} md:ml-auto md:w-56`}
        >
          <option value="">Todos os vendedores</option>
          {team.map((v) => (
            <option key={v.codigo} value={v.codigo}>
              {v.nome}
            </option>
          ))}
        </select>
      )}

      {pending && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-accent" role="status" aria-label="Atualizando" />
      )}
    </div>
  );
}

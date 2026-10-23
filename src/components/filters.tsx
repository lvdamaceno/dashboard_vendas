"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Preset } from "@/lib/period";
import { BusinessCard } from "./business-card";

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
  /** Master e admin: lojas para escolher (vazio = sem filtro de loja) */
  stores?: { codigo: number; nome: string }[];
  loja?: number;
  /** Gerente, master e admin veem o cartão; master e admin não têm cartão */
  showCard?: boolean;
  /** Master e admin: atalho para cadastrar metas */
  showGoals?: boolean;
}

// Alvos de toque de 44px no celular; um pouco mais compactos a partir do tablet
const control =
  "h-11 w-full min-w-0 rounded-full border border-line bg-surface px-4 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm";

/** Caixa de seleção com a seta desenhada, afastada da borda arredondada. */
function Select({ className = "", ...props }: React.ComponentProps<"select">) {
  return (
    <div className={`relative ${className}`}>
      <select {...props} className={`${control} cursor-pointer appearance-none pr-11`} />
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Filters({ preset, from, to, today, vendedor, team, stores = [], loja, showCard = true, showGoals = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState(preset === "periodo");
  const [de, setDe] = useState(from);
  // Semana e mês vão até o fim do período; o período personalizado não passa de hoje
  const [ate, setAte] = useState(to > today ? today : to);

  function navigate(next: { periodo: Preset; de?: string; ate?: string; vendedor?: number; loja?: number }) {
    const params = new URLSearchParams({ periodo: next.periodo });
    if (next.periodo === "periodo" && next.de && next.ate) {
      params.set("de", next.de);
      params.set("ate", next.ate);
    }
    if (next.loja) params.set("loja", String(next.loja));
    if (next.vendedor) params.set("vendedor", String(next.vendedor));
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  const current = { periodo: preset, de: from, ate: to, vendedor, loja };

  return (
    <div className="space-y-2 md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0" aria-busy={pending}>
      {/* No celular, períodos e cartão dividem a primeira linha; no desktop o cartão vai para a direita */}
      <div className="flex gap-2 md:contents">
        <div className="grid flex-1 grid-cols-4 rounded-full border border-line bg-surface p-1 md:inline-grid md:w-auto md:flex-none" role="tablist" aria-label="Período">
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
                className={`h-10 rounded-full px-3 font-title text-sm font-medium transition md:h-8 ${
                  active ? "bg-accent text-white" : "text-ink-2 hover:bg-bg-alt active:bg-bg-alt"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 md:order-last md:ml-auto">
          <Link
            href={loja ? `/fila?loja=${loja}` : "/fila"}
            aria-label="Fila de atendimento"
            className="flex shrink-0 items-center gap-2 self-stretch rounded-full border border-line bg-surface px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt active:bg-bg-alt md:h-10 md:self-auto"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="6" cy="8" r="2.2" />
              <circle cx="12" cy="8" r="2.2" />
              <circle cx="18" cy="8" r="2.2" />
              <path d="M3 18c0-2 1.3-3.5 3-3.5S9 16 9 18M9 18c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5M15 18c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Fila</span>
          </Link>
          {showGoals && (
            <Link
              href={loja ? `/metas?loja=${loja}` : "/metas"}
              className="flex shrink-0 items-center gap-2 self-stretch rounded-full border border-line bg-surface px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt active:bg-bg-alt md:h-10 md:self-auto"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
              <span className="hidden sm:inline">Metas</span>
            </Link>
          )}
          {showGoals && (
            <Link
              href="/feriados"
              aria-label="Feriados"
              className="flex shrink-0 items-center gap-2 self-stretch rounded-full border border-line bg-surface px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt active:bg-bg-alt md:h-10 md:self-auto"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeLinecap="round" />
                <path d="m9.5 15 2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Feriados</span>
            </Link>
          )}
          {showCard && <BusinessCard />}
        </div>
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
            className="col-span-2 h-11 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark active:bg-accent-dark md:h-10"
          >
            Aplicar período
          </button>
        </form>
      )}

      {stores.length > 0 && (
        <Select
          aria-label="Loja"
          value={loja ?? ""}
          // Trocar de loja limpa o vendedor, que é de outra equipe
          onChange={(e) => navigate({ ...current, loja: Number(e.target.value) || undefined, vendedor: undefined })}
          className="md:w-56"
        >
          <option value="">Todas as lojas</option>
          {stores.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nome}
            </option>
          ))}
        </Select>
      )}

      {team.length > 0 && (
        <Select
          aria-label="Vendedor"
          value={vendedor ?? ""}
          onChange={(e) => navigate({ ...current, vendedor: Number(e.target.value) || undefined })}
          className="md:w-56"
        >
          <option value="">Todos os vendedores</option>
          {team.map((v) => (
            <option key={v.codigo} value={v.codigo}>
              {v.nome}
            </option>
          ))}
        </Select>
      )}

      {pending && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-accent" role="status" aria-label="Atualizando" />
      )}
    </div>
  );
}

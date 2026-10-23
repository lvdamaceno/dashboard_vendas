"use client";

import { useDeferredValue, useState } from "react";
import { viewAs } from "@/app/admin/actions";
import type { Person } from "@/lib/sales";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Role = Person["role"];

const ROLES: { value: Role; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "gerente", label: "Gerente" },
  { value: "vendedor", label: "Vendedor" },
];

/** Admin escolhe, pelo nome, de qual master, gerente ou vendedor quer ver o painel; dá para filtrar por tipo de acesso. */
export function PersonPicker({ people, stores }: { people: Person[]; stores: { codigo: number; nome: string }[] }) {
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<Role[]>(ROLES.map((r) => r.value));
  const term = normalize(useDeferredValue(search).trim());
  const found = people.filter((p) => roles.includes(p.role) && (!term || normalize(p.nome).includes(term)));
  const loja = (codemp: number) => (codemp ? (stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`) : "Todas as lojas");
  const count = (role: Role) => people.filter((p) => p.role === role).length;

  const toggle = (role: Role) => setRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar pelo nome"
        aria-label="Buscar pelo nome"
        className="h-11 w-full rounded-full border border-line bg-bg px-5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de acesso">
        {ROLES.map((r) => {
          const on = roles.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(r.value)}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition ${
                on ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-3 hover:bg-bg-alt"
              }`}
            >
              {on ? "✓" : "+"} {r.label}
              <span className="tabular text-xs opacity-70">{count(r.value)}</span>
            </button>
          );
        })}
      </div>
      {found.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-3">{roles.length ? "Ninguém encontrado." : "Marque ao menos um tipo de acesso."}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {found.slice(0, 100).map((p) => (
            <li key={`${p.role}-${p.codigo}`}>
              <form action={viewAs}>
                <input type="hidden" name="tipo" value={p.role === "master" ? "master" : "sankhya"} />
                <input type="hidden" name="codigo" value={p.codigo} />
                <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-bg-alt">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {ROLES.find((r) => r.value === p.role)?.label} · {loja(p.codemp)}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {found.length > 100 && <p className="text-center text-xs text-ink-3">Mostrando 100 de {found.length}. Busque pelo nome para achar os outros.</p>}
    </div>
  );
}

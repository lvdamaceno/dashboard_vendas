"use client";

import { useDeferredValue, useState } from "react";
import { viewAs } from "@/app/admin/actions";
import type { Person } from "@/lib/sales";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Admin escolhe, pelo nome, de qual vendedor ou gerente quer ver o painel. */
export function PersonPicker({ people, stores }: { people: Person[]; stores: { codigo: number; nome: string }[] }) {
  const [search, setSearch] = useState("");
  const term = normalize(useDeferredValue(search).trim());
  const found = term ? people.filter((p) => normalize(p.nome).includes(term)) : people;
  const loja = (codemp: number) => stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar pelo nome"
        aria-label="Buscar vendedor ou gerente pelo nome"
        className="h-11 w-full rounded-full border border-line bg-bg px-5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:h-10 md:text-sm"
      />
      {found.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-3">Ninguém encontrado.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {found.slice(0, 100).map((p) => (
            <li key={p.codvend}>
              <form action={viewAs}>
                <input type="hidden" name="codvend" value={p.codvend} />
                <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-bg-alt">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {p.role === "gerente" ? "Gerente" : "Vendedor"} · {loja(p.codemp)}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useActionState, useDeferredValue, useEffect, useState, useTransition } from "react";
import { listEditablePhones, savePhone, type EditablePhone, type PhoneState } from "@/app/painel-actions";
import { formatPhone } from "@/lib/phone";

const field =
  "h-10 w-full min-w-0 rounded-full border border-line bg-bg px-4 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";
const small = "h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt disabled:opacity-50";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface FormProps {
  codvend: number;
  /** Telefone que vale hoje (formatado) */
  current: string | null;
  /** Já existe telefone salvo pelo app (mostra a opção de voltar ao do Sankhya) */
  fromApp?: boolean;
  /** Recebe o telefone salvo no app (null = voltou ao do Sankhya) */
  onDone?: (telefone: string | null) => void;
  onCancel?: () => void;
}

/** Campo para trocar o telefone do cartão (WhatsApp/QR code). */
export function PhoneForm({ codvend, current, fromApp, onDone, onCancel }: FormProps) {
  const [state, action, pending] = useActionState<PhoneState, FormData>(savePhone, {});

  useEffect(() => {
    if (state.ok) onDone?.(state.telefone ?? null);
  }, [state]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="codvend" value={codvend} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Celular com DDD (WhatsApp)</span>
        <input
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={20}
          defaultValue={current ?? ""}
          placeholder="(11) 98765-4321"
          className={field}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {fromApp && (
          // Apaga o telefone salvo no app: o cartão volta a usar o do Sankhya
          <button type="submit" name="limpar" value="1" formNoValidate disabled={pending} className={small}>
            Usar o do Sankhya
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-sm text-ink-2 hover:bg-bg-alt">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** Lista de telefones com busca: o gerente edita a equipe da loja; o admin, todos. */
export function PhoneList({ people: initial, stores = [] }: { people: EditablePhone[]; stores?: { codigo: number; nome: string }[] }) {
  // Cópia local: depois de salvar, a lista mostra o telefone novo sem recarregar a página
  const [people, setPeople] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number>();
  const term = normalize(useDeferredValue(search).trim());
  const found = term ? people.filter((p) => normalize(p.nome).includes(term)) : people;
  const loja = (codemp: number) => stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`;

  if (people.length === 0) return <p className="py-4 text-center text-sm text-ink-3">Nenhum vendedor ativo.</p>;

  return (
    <div className="space-y-3">
      {people.length > 8 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar pelo nome"
          className={field}
        />
      )}
      <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
        {found.slice(0, 150).map((p) => {
          const tel = p.app ?? p.sankhya;
          return (
            <li key={p.codvend} className="space-y-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="text-xs text-ink-3">
                    {p.role === "gerente" ? "Gerente" : "Vendedor"}
                    {stores.length > 0 && <> · {loja(p.codemp)}</>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm">{tel ? formatPhone(tel) : <span className="text-ink-3">sem telefone</span>}</p>
                  {tel && <p className="text-xs text-ink-3">{p.app ? "salvo no app" : "do Sankhya"}</p>}
                </div>
                {editing !== p.codvend && (
                  <button type="button" onClick={() => setEditing(p.codvend)} className={small}>
                    Editar
                  </button>
                )}
              </div>
              {editing === p.codvend && (
                <PhoneForm
                  codvend={p.codvend}
                  current={tel ? formatPhone(tel) : null}
                  fromApp={Boolean(p.app)}
                  onDone={(app) => {
                    setPeople((list) => list.map((x) => (x.codvend === p.codvend ? { ...x, app } : x)));
                    setEditing(undefined);
                  }}
                  onCancel={() => setEditing(undefined)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Para o gerente no painel: carrega os telefones da equipe só quando abre. */
export function TeamPhones() {
  const [people, setPeople] = useState<EditablePhone[]>();
  const [error, setError] = useState<string>();
  const [loading, startLoading] = useTransition();

  function load() {
    startLoading(async () => {
      const res = await listEditablePhones();
      if ("error" in res) setError(res.error);
      else {
        setError(undefined);
        setPeople(res);
      }
    });
  }

  return (
    <details
      className="rounded-3xl border border-line bg-surface p-5"
      onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !people && load()}
    >
      <summary className="cursor-pointer font-title font-medium">Telefones da equipe</summary>
      <p className="mt-1 text-sm text-ink-2">O telefone aparece no cartão de visita e no QR code do WhatsApp de cada um.</p>
      <div className="mt-3">
        {error ? (
          <p className="text-sm text-bad">{error}</p>
        ) : loading || !people ? (
          <p className="py-4 text-center text-sm text-ink-3">Carregando…</p>
        ) : (
          <PhoneList people={people} />
        )}
      </div>
    </details>
  );
}

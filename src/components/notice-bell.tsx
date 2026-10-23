"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { seeNotices, sendNotice, type FormState } from "@/app/painel-actions";
import type { Notice } from "@/lib/painel";
import type { Session } from "@/lib/session";
import { Select } from "@/components/select";

const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const field =
  "w-full rounded-2xl border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";

interface Props {
  notices: Notice[];
  role: Session["role"];
  stores: { codigo: number; nome: string }[];
  /** loja do gerente (destino fixo dos avisos dele) */
  lojaNome: string;
}

/** Sino do canto superior esquerdo: marca avisos novos; gerente, master e admin também enviam. */
export function NoticeBell({ notices, role, stores, lojaNome }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [seen, setSeen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(sendNotice, {});
  const unread = !seen && notices.some((n) => n.novo);
  const canSend = role !== "vendedor";
  const target = (codemp: number | null) => (codemp ? (stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`) : "Todas as lojas");

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      setWriting(false);
    }
  }, [state]);

  function open() {
    dialog.current?.showModal();
    if (unread) {
      setSeen(true);
      seeNotices();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={unread ? "Avisos (há avisos novos)" : "Avisos"}
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {unread && <span className="absolute top-1.5 right-1.5 size-3 rounded-full bg-smile ring-2 ring-[#d71921]" />}
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[85dvh] w-full max-w-md overflow-hidden rounded-3xl bg-surface p-0 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg">Avisos</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="h-9 rounded-full px-3 text-sm text-ink-2 hover:bg-bg-alt">
              Fechar
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {canSend &&
              (writing ? (
                <form ref={form} action={action} className="space-y-2 rounded-2xl border border-line bg-bg-alt p-3">
                  <input name="titulo" required maxLength={120} placeholder="Título" className={field} />
                  <textarea name="mensagem" required maxLength={2000} rows={4} placeholder="Mensagem" className={field} />
                  {role === "gerente" ? (
                    <p className="text-xs text-ink-3">Vai para a sua equipe ({lojaNome}).</p>
                  ) : (
                    <Select name="loja" aria-label="Para quem" defaultValue="" className={field}>
                      <option value="">Todas as lojas</option>
                      {stores.map((s) => (
                        <option key={s.codigo} value={s.codigo}>
                          {s.nome}
                        </option>
                      ))}
                    </Select>
                  )}
                  {state.error && (
                    <p role="alert" className="text-sm text-bad">
                      {state.error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="h-10 flex-1 rounded-full bg-accent px-4 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
                    >
                      {pending ? "Enviando…" : "Enviar aviso"}
                    </button>
                    <button type="button" onClick={() => setWriting(false)} className="h-10 rounded-full px-4 text-sm text-ink-2 hover:bg-surface">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setWriting(true)}
                  className="h-10 w-full rounded-full border border-line font-title text-sm font-medium text-accent hover:bg-bg-alt"
                >
                  + Novo aviso {role === "gerente" ? "para a equipe" : ""}
                </button>
              ))}

            {notices.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-3">Nenhum aviso por enquanto.</p>
            ) : (
              <ul className="space-y-3">
                {notices.map((n) => (
                  <li key={n.id} className={`rounded-2xl border p-4 ${n.novo ? "border-accent/40 bg-accent-soft" : "border-line"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-title font-medium">{n.titulo}</p>
                      {n.novo && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">Novo</span>}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{n.mensagem}</p>
                    <p className="mt-2 text-xs text-ink-3">
                      {n.autorNome} · {when.format(new Date(n.criadoEm))}
                      {role !== "vendedor" && <> · {target(n.codemp)}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

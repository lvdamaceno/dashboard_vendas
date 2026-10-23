"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendNotice, type FormState } from "../painel-actions";
import { saveMaster, type AdminState } from "./actions";

const field =
  "w-full rounded-2xl border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";
const submit =
  "h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60";

/** Limpa o formulário depois de salvar. */
function useResetOnOk(state: { ok?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return form;
}

export function NoticeForm({ stores }: { stores: { codigo: number; nome: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendNotice, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input name="titulo" required maxLength={120} placeholder="Título" className={field} />
      <textarea name="mensagem" required maxLength={2000} rows={4} placeholder="Mensagem" className={field} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="loja" aria-label="Para quem" defaultValue="" className={`${field} sm:flex-1`}>
          <option value="">Todo mundo (todas as lojas)</option>
          {stores.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nome}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Aviso enviado.</p>}
    </form>
  );
}

export function MasterForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveMaster, {});
  const form = useResetOnOk(state);
  return (
    <form ref={form} action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="nome" required maxLength={120} placeholder="Nome" className={`${field} sm:flex-1`} />
        <input name="cpf" required inputMode="numeric" maxLength={14} placeholder="CPF" className={`${field} sm:w-48`} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Salvando…" : "Adicionar"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Master salvo. Ele já pode entrar com o CPF.</p>}
    </form>
  );
}

/** Botão de envio que pede confirmação antes (ex.: remover). */
export function ConfirmButton({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}

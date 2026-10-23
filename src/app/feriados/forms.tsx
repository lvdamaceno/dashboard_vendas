"use client";

import { useActionState, useEffect, useRef } from "react";
import { addHoliday, addOpenDay, copyHolidays, type HolidayState } from "./actions";

const field =
  "w-full rounded-2xl border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";
const submit =
  "h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60";

export function HolidayForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<HolidayState, FormData>(addHoliday, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="dia" type="date" required min={`${year}-01-01`} max={`${year}-12-31`} aria-label="Data" className={`${field} sm:w-48`} />
        <input name="nome" required maxLength={120} placeholder="Nome (ex.: Loja fechada para inventário)" className={`${field} sm:flex-1`} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Salvando…" : "Criar feriado"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Feriado criado. As metas diárias já consideram esse dia.</p>}
    </form>
  );
}

/** Copia os feriados criados e os ajustes do ano anterior (o calendário oficial já é calculado sozinho). */
export function CopyHolidaysForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<HolidayState, FormData>(copyHolidays, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ano" value={year} />
      <button type="submit" disabled={pending} className="h-10 rounded-full border border-line px-5 text-sm font-medium hover:bg-bg-alt disabled:opacity-60">
        {pending ? "Copiando…" : `Copiar feriados criados e ajustes de ${year - 1}`}
      </button>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Copiado. Confira a lista abaixo.</p>}
    </form>
  );
}

/** Botão de envio que pede confirmação antes (ex.: remover). */
export function ConfirmSubmit({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}

/** Domingo (ou outro dia sem expediente normal) em que a loja abre: conta como dia útil nas metas. */
export function OpenDayForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState<HolidayState, FormData>(addOpenDay, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="dia" type="date" required min={`${year}-01-01`} max={`${year}-12-31`} aria-label="Data" className={`${field} sm:w-48`} />
        <input name="nome" maxLength={120} placeholder="Motivo (opcional, ex.: Dia das Mães)" className={`${field} sm:flex-1`} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Salvando…" : "Marcar expediente"}
        </button>
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Dia marcado. Ele passa a contar como dia útil nas metas.</p>}
    </form>
  );
}

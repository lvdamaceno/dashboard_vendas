"use client";

import { useActionState } from "react";
import { copyGoalsAction, type GoalsState } from "./actions";

/** Botão "copiar metas do mês anterior" (da loja escolhida ou de todas). */
export function CopyGoals({ mes, loja, label }: { mes: string; loja?: number; label: string }) {
  const [state, action, pending] = useActionState<GoalsState, FormData>(copyGoalsAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="loja" value={loja ?? ""} />
      <button type="submit" disabled={pending} className="h-10 rounded-full border border-line bg-surface px-5 text-sm font-medium hover:bg-bg-alt disabled:opacity-60">
        {pending ? "Copiando…" : label}
      </button>
      {state.error && <span className="text-sm text-bad">{state.error}</span>}
      {state.ok && <span className="text-sm text-good">Metas copiadas. Revise e salve se mudar algo.</span>}
    </form>
  );
}

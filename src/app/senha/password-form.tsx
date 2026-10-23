"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeMasterPassword, type PasswordState } from "../actions";

const input =
  "w-full rounded-full border border-line bg-bg px-5 py-2.5 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeMasterPassword, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-3">
      {[
        ["atual", "Senha atual", "current-password"],
        ["nova", "Nova senha (pelo menos 8 caracteres)", "new-password"],
        ["confirmacao", "Repita a nova senha", "new-password"],
      ].map(([name, label, ac]) => (
        <label key={name} className="block space-y-1.5">
          <span className="text-sm font-medium">{label}</span>
          <input name={name} type="password" required minLength={name === "atual" ? undefined : 8} maxLength={200} autoComplete={ac} className={input} />
        </label>
      ))}
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-good">Senha trocada. Use a nova senha no próximo acesso.</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-accent px-6 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}

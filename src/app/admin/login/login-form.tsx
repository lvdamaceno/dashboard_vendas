"use client";

import { useActionState } from "react";
import { adminLogin, type AdminState } from "../actions";

const input =
  "w-full rounded-full border border-line bg-bg px-5 py-3 text-base outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(adminLogin, {});

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-line bg-surface p-6">
      <div className="space-y-1.5">
        <label htmlFor="usuario" className="text-sm font-medium">
          Usuário
        </label>
        <input id="usuario" name="usuario" autoComplete="username" required maxLength={100} className={input} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="senha" className="text-sm font-medium">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required maxLength={200} className={input} />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-accent px-4 font-title text-base font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

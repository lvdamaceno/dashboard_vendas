"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

const input =
  "w-full rounded-lg border border-line bg-bg px-3 py-3 text-base outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Usuário
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="characters"
          required
          maxLength={60}
          defaultValue={state.username}
          className={input}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className={input}
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

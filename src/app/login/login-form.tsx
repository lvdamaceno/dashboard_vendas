"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

const input =
  "w-full rounded-full border border-line bg-bg px-5 py-3 text-base outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-line bg-surface p-6">
      <div className="space-y-1.5">
        <label htmlFor="cpf" className="text-sm font-medium">
          CPF
        </label>
        <input
          id="cpf"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          required
          maxLength={14}
          pattern="[0-9.\-\s]{11,14}"
          defaultValue={state.cpf}
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
        className="h-12 w-full rounded-full bg-accent px-4 font-title text-base font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

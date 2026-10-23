"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions";

const input =
  "w-full rounded-full border border-line bg-bg px-5 py-3 text-base outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function LoginForm() {
  // Trocar de CPF recria o formulário do zero
  const [tentativa, setTentativa] = useState(0);
  return <Form key={tentativa} onReset={() => setTentativa((n) => n + 1)} />;
}

/** CPF; para a diretoria (master), em seguida a senha — ou a criação dela, no primeiro acesso. */
function Form({ onReset }: { onReset: () => void }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const etapa = state.etapa;

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-line bg-surface p-6">
      {etapa ? (
        <>
          <input type="hidden" name="cpf" value={state.cpf ?? ""} />
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-alt px-4 py-3 text-sm">
            <span>
              <span className="text-ink-3">CPF</span> <span className="tabular font-medium">{state.cpf}</span>
            </span>
            <button type="button" onClick={onReset} className="text-accent underline-offset-4 hover:underline">
              Trocar
            </button>
          </div>
          {etapa === "criar" && (
            <p className="text-sm text-ink-2">
              Olá{state.nome ? `, ${state.nome}` : ""}! É o seu primeiro acesso: crie uma senha com pelo menos 8 caracteres. Ela será pedida
              sempre que você entrar.
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="senha" className="text-sm font-medium">
              {etapa === "criar" ? "Crie a sua senha" : "Senha"}
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={etapa === "criar" ? 8 : undefined}
              maxLength={200}
              autoComplete={etapa === "criar" ? "new-password" : "current-password"}
              autoFocus
              className={input}
            />
          </div>
          {etapa === "criar" && (
            <div className="space-y-1.5">
              <label htmlFor="confirmacao" className="text-sm font-medium">
                Repita a senha
              </label>
              <input id="confirmacao" name="confirmacao" type="password" required minLength={8} maxLength={200} autoComplete="new-password" className={input} />
            </div>
          )}
        </>
      ) : (
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
      )}
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
        {pending ? "Entrando…" : etapa === "criar" ? "Criar senha e entrar" : "Entrar"}
      </button>
    </form>
  );
}

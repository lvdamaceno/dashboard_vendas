"use client";

import { useActionState, useRef } from "react";
import { sendFeedback, type FormState } from "@/app/painel-actions";

/** Botão para o usuário mandar sugestões ou relatar erros; chegam no painel do admin. */
export function FeedbackButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(sendFeedback, {});

  return (
    <section className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-5 py-5 text-center sm:flex-row sm:text-left">
      <p className="flex-1 text-sm text-ink-2">Tem uma ideia para o painel ou encontrou algo errado?</p>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="h-11 shrink-0 rounded-full border border-line bg-surface px-5 font-title text-sm font-medium text-accent hover:bg-bg-alt md:h-10"
      >
        Enviar sugestão ou erro
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-left text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {state.ok ? (
          <div className="space-y-4 p-6 text-center">
            <p className="font-title text-lg font-medium">Recebemos, obrigado!</p>
            <p className="text-sm text-ink-2">Sua mensagem foi para a equipe que cuida do painel.</p>
            <button type="button" onClick={() => dialog.current?.close()} className="h-10 rounded-full bg-accent px-6 font-title text-sm font-medium text-white">
              Fechar
            </button>
          </div>
        ) : (
          <form
            action={action}
            onSubmit={(e) => {
              const f = e.currentTarget;
              (f.elements.namedItem("pagina") as HTMLInputElement).value = location.pathname + location.search;
              (f.elements.namedItem("navegador") as HTMLInputElement).value = navigator.userAgent;
            }}
            className="space-y-4 p-6"
          >
            <h2 className="text-lg">Sugestões e erros</h2>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Tipo</legend>
              {[
                ["sugestao", "💡 Sugestão"],
                ["erro", "⚠️ Erro"],
              ].map(([value, label], i) => (
                <label
                  key={value}
                  className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-line text-sm font-medium has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent"
                >
                  <input type="radio" name="tipo" value={value} defaultChecked={i === 0} className="sr-only" />
                  {label}
                </label>
              ))}
            </fieldset>
            <textarea
              name="mensagem"
              required
              maxLength={4000}
              rows={5}
              placeholder="Conte o que você gostaria de ver no painel ou o que aconteceu de errado."
              className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/15 md:text-sm"
            />
            <input type="hidden" name="pagina" />
            <input type="hidden" name="navegador" />
            {state.error && (
              <p role="alert" className="text-sm text-bad">
                {state.error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="h-11 flex-1 rounded-full bg-accent px-4 font-title text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Enviar"}
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className="h-11 rounded-full px-4 text-sm text-ink-2 hover:bg-bg-alt">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}

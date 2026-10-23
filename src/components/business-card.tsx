"use client";

import { useRef, useState, useTransition } from "react";
import { getBusinessCard, type BusinessCard as CardData } from "@/app/actions";
import { PhoneForm } from "./phone-editor";
import { Logo, Smile } from "./logo";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

export function BusinessCard() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [card, setCard] = useState<CardData>();
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, startLoading] = useTransition();

  function open() {
    setFlipped(false);
    setEditing(false);
    dialog.current?.showModal();
    if (!card?.ok) startLoading(async () => setCard(await getBusinessCard()));
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Cartão de visita"
        className="flex shrink-0 items-center gap-2 self-stretch rounded-full border border-line bg-surface px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt active:bg-bg-alt md:h-10 md:self-auto"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15h4M7 11h6M16 10h1M16 14h1" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Cartão</span>
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-full max-w-xs overflow-visible bg-transparent p-4 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {loading || !card ? (
          <div className="flex aspect-[55/90] items-center justify-center rounded-3xl bg-surface text-sm text-ink-3">Carregando…</div>
        ) : !card.ok ? (
          <div className="flex aspect-[55/90] items-center justify-center rounded-3xl bg-surface p-6 text-center text-sm text-ink-2">{card.error}</div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Mostrar o QR code do WhatsApp" : "Mostrar nome e telefone"}
            className="block aspect-[55/90] w-full perspective-[1200px]"
          >
            <div
              className={`relative size-full transition-transform duration-500 transform-3d motion-reduce:transition-none ${flipped ? "rotate-y-180" : ""}`}
            >
              {/* Verso, com nome e telefone. Cores fixas da marca (não mudam com o tema escuro) */}
              <div className="absolute inset-0 flex rotate-y-180 flex-col items-center justify-center gap-6 rounded-3xl bg-[#fdb917] px-6 text-center text-[#b0141b] shadow-2xl backface-hidden">
                <Logo variant="seal" className="w-44 rounded-xl" title="Casa Contente" />
                <div>
                  <p className="font-title text-3xl leading-tight font-semibold text-[#d71921] uppercase">{card.nome}</p>
                  <p className="mt-1 font-title text-sm font-medium tracking-widest uppercase">{card.cargo}</p>
                </div>
                {card.telefone ? (
                  <p className="tabular flex items-center gap-2 font-title text-xl font-medium">
                    <WhatsAppIcon className="size-6" />
                    {card.telefone}
                  </p>
                ) : (
                  <p className="text-sm">Telefone não cadastrado</p>
                )}
                <p className="absolute bottom-5 text-xs">Toque para virar</p>
              </div>

              {/* Frente, a primeira que aparece: QR code do WhatsApp */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-3xl bg-[#d71921] px-6 text-center text-white shadow-2xl backface-hidden">
                {card.qrSvg ? (
                  <>
                    <div
                      className="w-full rounded-2xl bg-white p-4 [&>svg]:block [&>svg]:size-full"
                      role="img"
                      aria-label={`QR code do WhatsApp de ${card.nome}`}
                      dangerouslySetInnerHTML={{ __html: card.qrSvg }}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <WhatsAppIcon className="size-7" />
                      <p className="font-title text-base font-medium">Aponte a câmera para falar comigo no WhatsApp</p>
                    </div>
                    <Smile className="h-5 w-auto" />
                  </>
                ) : (
                  <p className="text-sm">Toque em “Atualizar telefone”, embaixo, para gerar o QR code do WhatsApp.</p>
                )}
                <p className="absolute bottom-5 text-xs text-white/80">Toque para virar</p>
              </div>
            </div>
          </button>
        )}
        {card?.ok && editing && (
          <div className="mt-4 rounded-3xl bg-surface p-4">
            <PhoneForm
              codvend={card.codvend}
              current={card.telefone}
              fromApp={card.doApp}
              onDone={() => {
                setEditing(false);
                // Recarrega o cartão para o QR code usar o telefone novo
                startLoading(async () => setCard(await getBusinessCard()));
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
        <div className="mt-4 flex justify-center gap-2">
          {card?.ok && !editing && !loading && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-11 rounded-full bg-white/15 px-5 font-title text-sm font-medium text-white hover:bg-white/25 active:bg-white/25"
            >
              Atualizar telefone
            </button>
          )}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="h-11 rounded-full bg-white/15 px-6 font-title text-sm font-medium text-white hover:bg-white/25 active:bg-white/25"
          >
            Fechar
          </button>
        </div>
      </dialog>
    </>
  );
}

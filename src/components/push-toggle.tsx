"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getPushKey, subscribePush, unsubscribePush } from "@/app/painel-actions";

type Estado = "carregando" | "sem-suporte" | "instalar-iphone" | "bloqueado" | "desligado" | "ligado";

const toKey = (base64: string) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  // Em desenvolvimento o service worker não é registrado sozinho
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

/**
 * Ativa as notificações no celular ("É a sua vez!" na fila, avisos e lembretes).
 * banner: versão discreta que some depois de ativar (ou ao tocar em "Agora não").
 */
export function PushToggle({ banner = false }: { banner?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string>();
  const [fechado, setFechado] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
        // No iPhone, só funciona com o painel instalado na tela inicial
        return setEstado(ios && !instalado ? "instalar-iphone" : "sem-suporte");
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub && Notification.permission === "granted" ? "ligado" : "desligado");
    })().catch(() => setEstado("sem-suporte"));
    try {
      setFechado(localStorage.getItem("dv-push-banner") === "fechado");
    } catch {
      // sem localStorage: mostra normalmente
    }
  }, []);

  function ativar() {
    setErro(undefined);
    start(async () => {
      try {
        if ((await Notification.requestPermission()) !== "granted") return setEstado("bloqueado");
        const key = await getPushKey();
        const reg = await registration();
        if (!key || !reg) return setErro("Não foi possível ativar agora. Tente de novo mais tarde.");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
        const res = await subscribePush(sub.toJSON());
        if (res.error) return setErro(res.error);
        setEstado("ligado");
      } catch {
        setErro("Não foi possível ativar neste aparelho.");
      }
    });
  }

  function desativar() {
    start(async () => {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setEstado("desligado");
    });
  }

  function fechar() {
    setFechado(true);
    try {
      localStorage.setItem("dv-push-banner", "fechado");
    } catch {
      // ignora
    }
  }

  if (estado === "carregando" || estado === "sem-suporte") return null;
  // No painel, o aviso só aparece enquanto as notificações não estão ligadas
  if (banner && (estado === "ligado" || estado === "bloqueado" || fechado)) return null;

  const box = "flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface p-4";
  const btn = "h-10 rounded-full px-5 font-title text-sm font-medium disabled:opacity-60";

  return (
    <section className={box} aria-live="polite">
      <span className="text-2xl" aria-hidden>
        🔔
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-title font-medium">Notificações no celular</p>
        <p className="text-sm text-ink-2">
          {estado === "ligado" && "Ativadas neste aparelho: você recebe “É a sua vez!” da fila e os avisos, mesmo com o painel fechado."}
          {estado === "desligado" && "Receba “É a sua vez!” da fila e os avisos da gerência, mesmo com o painel fechado."}
          {estado === "bloqueado" && "As notificações estão bloqueadas para este site. Libere nas configurações do navegador do celular."}
          {estado === "instalar-iphone" && (
            <>
              No iPhone, as notificações só funcionam com o painel instalado na tela inicial.{" "}
              <Link href="/ajuda" className="text-accent underline-offset-4 hover:underline">
                Veja como instalar
              </Link>
              .
            </>
          )}
        </p>
        {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
      </div>
      <div className="flex gap-2">
        {estado === "desligado" && (
          <button type="button" onClick={ativar} disabled={pending} className={`${btn} bg-accent text-white hover:bg-accent-dark`}>
            {pending ? "Ativando…" : "Ativar"}
          </button>
        )}
        {estado === "ligado" && !banner && (
          <button type="button" onClick={desativar} disabled={pending} className={`${btn} border border-line text-ink-2 hover:bg-bg-alt`}>
            Desativar
          </button>
        )}
        {banner && (
          <button type="button" onClick={fechar} className={`${btn} text-ink-3 hover:bg-bg-alt`}>
            Agora não
          </button>
        )}
      </div>
    </section>
  );
}

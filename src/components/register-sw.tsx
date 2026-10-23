"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Registra o service worker que permite instalar o painel como app e ver os dados sem internet. */
export function RegisterSW() {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  // Na tela de login (logout, sessão expirada) a cópia offline do painel é apagada
  useEffect(() => {
    if (pathname !== "/login" && pathname !== "/admin/login") return;
    globalThis.caches?.delete("dv-dados").catch(() => undefined);
    navigator.serviceWorker?.controller?.postMessage("limpar-dados");
  }, [pathname]);

  return null;
}

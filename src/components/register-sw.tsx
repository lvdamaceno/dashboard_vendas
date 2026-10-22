"use client";

import { useEffect } from "react";

/** Registra o service worker que permite instalar o painel como app. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

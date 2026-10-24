"use client";

import { useEffect } from "react";

// Renovação de 5 em 5 minutos; a confirmação vale 15 (LOCAL_TTL_MIN em src/lib/acesso.ts)
const REFRESH_MS = 5 * 60_000;

/** offline: falhou a conexão, não a localização */
export type LocationResult = { ok: true; local?: string } | { ok: false; error: string; offline?: boolean };

/** Pede a localização ao aparelho e confere no servidor (/api/acesso). */
export async function confirmLocation(): Promise<LocationResult> {
  if (!("geolocation" in navigator)) return { ok: false, error: "Este navegador não informa a localização. Use o Chrome ou o Safari." };
  let pos: GeolocationPosition;
  try {
    pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }),
    );
  } catch (err) {
    const code = (err as GeolocationPositionError).code;
    return {
      ok: false,
      error:
        code === 1
          ? "A localização está bloqueada para o painel. Libere nas configurações do navegador (ícone ao lado do endereço) e tente de novo."
          : "Não foi possível pegar a sua localização. Ligue o GPS ou o Wi-Fi e tente de novo.",
    };
  }
  const res = await fetch("/api/acesso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Sem conexão. Tente de novo.", offline: true };
  if (res.status === 401) {
    location.href = "/sessao-expirada";
    return { ok: false, error: "Sessão expirada." };
  }
  return (await res.json()) as LocationResult;
}

/**
 * Com a trava de local ligada para o grupo, confirma de novo onde o aparelho está enquanto a tela fica aberta
 * (e ao voltar para ela). Saiu do local: vai para a tela de confirmação.
 */
export function LocationGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = Date.now();
    let cancelled = false;

    const check = async () => {
      last = Date.now();
      const r = await confirmLocation();
      if (!r.ok && !r.offline && !cancelled) location.href = `/acesso?${new URLSearchParams({ volta: location.pathname + location.search })}`;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > REFRESH_MS) void check();
    };

    fetch("/api/acesso", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { exigido: false }))
      .then(({ exigido }: { exigido: boolean }) => {
        if (!exigido || cancelled) return;
        timer = setInterval(() => document.visibilityState === "visible" && void check(), REFRESH_MS);
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

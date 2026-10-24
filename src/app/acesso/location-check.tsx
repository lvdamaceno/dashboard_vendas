"use client";

import { useCallback, useEffect, useState } from "react";
import { logout } from "../actions";
import { confirmLocation } from "@/components/location-guard";

/** Pede a localização assim que abre; dentro de um local, segue para a página que a pessoa queria. */
export function LocationCheck({ volta }: { volta: string }) {
  const [estado, setEstado] = useState<{ status: "conferindo" } | { status: "ok"; local?: string } | { status: "erro"; error: string }>({ status: "conferindo" });

  const conferir = useCallback(async () => {
    setEstado({ status: "conferindo" });
    const r = await confirmLocation();
    if (!r.ok) return setEstado({ status: "erro", error: r.error });
    setEstado({ status: "ok", local: r.local });
    // Navegação completa: o proxy confere o cookie novo
    location.replace(volta);
  }, [volta]);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  return (
    <div className="space-y-4 rounded-3xl border border-line bg-surface p-6 text-center">
      {estado.status === "conferindo" && <p className="text-sm text-ink-2">Conferindo a sua localização…</p>}
      {estado.status === "ok" && <p className="text-sm text-good">Localização confirmada{estado.local ? `: ${estado.local}` : ""}. Abrindo o painel…</p>}
      {estado.status === "erro" && (
        <>
          <p role="alert" className="text-sm text-bad">
            {estado.error}
          </p>
          <button
            type="button"
            onClick={conferir}
            className="h-12 w-full rounded-full bg-accent px-4 font-title text-base font-medium text-white transition hover:bg-accent-dark"
          >
            Tentar de novo
          </button>
        </>
      )}
      <form action={logout}>
        <button type="submit" className="text-sm text-accent underline-offset-4 hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}

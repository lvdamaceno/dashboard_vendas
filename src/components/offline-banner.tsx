"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Sem internet, o app instalado mostra a última versão do painel salva; este aviso diz de quando ela é. */
export function OfflineBanner({ updatedAt }: { updatedAt: string }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return <p className="text-xs text-ink-3">Atualizado em {updatedAt}</p>;
  return (
    <p role="status" className="rounded-2xl bg-smile/25 px-4 py-2 text-sm">
      <strong>Sem internet.</strong> Mostrando os dados salvos em {updatedAt}. Os filtros voltam a funcionar quando a conexão voltar.
    </p>
  );
}

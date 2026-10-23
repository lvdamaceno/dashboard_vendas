import type { Instrumentation } from "next";

// Monitor da tela Saúde do admin (src/lib/monitor.ts): só no servidor Node.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMonitor } = await import("./lib/monitor-node");
    startMonitor();
  }
}

// Erros de página/ação capturados pelo Next entram no log com a rota
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? ` (digest ${String(err.digest)})` : "";
  console.error(`[next] ${request.method} ${request.path} — ${context.routeType}: ${message}${digest}`);
};

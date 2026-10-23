// Liga o monitor no servidor Node (chamado uma vez pelo instrumentation.ts): copia o console para a
// memória e grava em lotes, a cada poucos segundos, os eventos que precisam ficar no banco.
import { Pool } from "pg";
import { monitor, record, type Nivel } from "./monitor";

let pool: Pool | undefined;
function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const host = new URL(url).hostname;
  const external = host.includes(".") && !/^(localhost|127\.)/.test(host);
  pool ??= new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 30_000, ssl: external ? { rejectUnauthorized: false } : undefined });
  return pool;
}

async function flush() {
  const lote = monitor.pendentes.splice(0, monitor.pendentes.length);
  const db = getPool();
  if (!lote.length || !db) return;
  try {
    await db.query(
      `INSERT INTO painel.evento (criado_em, nivel, mensagem)
       SELECT to_timestamp(t / 1000.0), n, m FROM unnest($1::float8[], $2::text[], $3::text[]) AS x(t, n, m)`,
      [lote.map((e) => e.at), lote.map((e) => e.nivel), lote.map((e) => e.msg)],
    );
    // De vez em quando, apaga o que tem mais de 30 dias
    if (Math.random() < 0.05) await db.query(`DELETE FROM painel.evento WHERE criado_em < now() - interval '30 days'`);
  } catch (err) {
    // Sem banco, os eventos ficam só na memória (prefixo [monitor] não é registrado de novo)
    console.error("[monitor] não foi possível gravar eventos:", err instanceof Error ? err.message : err);
  }
}

export function startMonitor() {
  const g = globalThis as unknown as { __painelMonitorOn?: boolean };
  if (g.__painelMonitorOn) return;
  g.__painelMonitorOn = true;
  for (const [metodo, nivel] of [
    ["log", "info"],
    ["info", "info"],
    ["warn", "warn"],
    ["error", "error"],
  ] as const) {
    const original = console[metodo].bind(console);
    console[metodo] = (...args: unknown[]) => {
      original(...args);
      try {
        record(nivel as Nivel, args);
      } catch {
        // o log nunca pode derrubar a aplicação
      }
    };
  }
  setInterval(() => void flush(), 5000).unref();
}

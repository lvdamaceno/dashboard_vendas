// Monitor do servidor para a tela Saúde do admin: logs recentes em memória, métricas de uso
// desde o último reinício e gravação de erros, alertas e acessos no Postgres (painel.evento).
// Fica em globalThis porque o Next pode carregar este módulo mais de uma vez no mesmo processo.

export type Nivel = "info" | "warn" | "error";
export interface LogEntry {
  at: number;
  nivel: Nivel;
  msg: string;
}

interface Store {
  inicio: number;
  logs: LogEntry[];
  sankhya: { chamadas: number; falhas: number; cache: number; tempos: number[]; ultimoErro: { at: number; msg: string } | null };
  logins: { ok: number; recusados: number };
  pendentes: LogEntry[];
}

const MAX_LOGS = 2000;
const g = globalThis as unknown as { __painelMonitor?: Store };
export const monitor: Store = (g.__painelMonitor ??= {
  inicio: Date.now(),
  logs: [],
  sankhya: { chamadas: 0, falhas: 0, cache: 0, tempos: [], ultimoErro: null },
  logins: { ok: 0, recusados: 0 },
  pendentes: [],
});

const text = (args: unknown[]) =>
  args
    .map((a) => (a instanceof Error ? `${a.message}${a.stack ? `\n${a.stack.split("\n").slice(1, 4).join("\n")}` : ""}` : typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")
    .slice(0, 4000);

// Vão para o banco: erros, alertas e acessos (logins e ações do admin). O resto fica só na memória.
const persiste = (nivel: Nivel, msg: string) => nivel !== "info" || /^\[(login|admin)\]/.test(msg);

export function record(nivel: Nivel, args: unknown[]) {
  const msg = text(args);
  if (msg.startsWith("[monitor]")) return;
  const entry = { at: Date.now(), nivel, msg };
  monitor.logs.push(entry);
  if (monitor.logs.length > MAX_LOGS) monitor.logs.splice(0, monitor.logs.length - MAX_LOGS);
  if (/^\[login\] ok /.test(msg)) monitor.logins.ok++;
  else if (/^\[login\] .*sem acesso|^\[admin\] login recusado/.test(msg)) monitor.logins.recusados++;
  if (persiste(nivel, msg) && monitor.pendentes.length < 500) monitor.pendentes.push(entry);
}

/** Cada ida ao Sankhya (ok ou falha); cache = resultado reaproveitado sem ir ao Sankhya. */
export function recordSankhya(ms: number, erro?: string) {
  const s = monitor.sankhya;
  s.chamadas++;
  s.tempos.push(ms);
  if (s.tempos.length > 500) s.tempos.shift();
  if (erro) {
    s.falhas++;
    s.ultimoErro = { at: Date.now(), msg: erro.slice(0, 500) };
  }
}
export const recordCacheHit = () => void monitor.sankhya.cache++;

import "server-only";
import { sql } from "./db";
import { monitor, type LogEntry, type Nivel } from "./monitor";
import { query } from "./sankhya/client";

// Verificações da tela Saúde do admin. Tudo é medido na hora em que a tela abre.

export interface Check {
  ok: boolean;
  ms: number;
  detalhe: string;
}

async function timed(run: () => Promise<string>): Promise<Check> {
  const started = Date.now();
  try {
    const detalhe = await run();
    return { ok: true, ms: Date.now() - started, detalhe };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, detalhe: err instanceof Error ? err.message : String(err) };
  }
}

export async function connectionChecks() {
  const [postgres, sankhya] = await Promise.all([
    timed(async () => {
      const [r] = await sql<{ versao: string; tamanho: string }>(
        `SELECT split_part(version(), ' ', 2) AS versao, pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS tamanho
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'painel' AND c.relkind = 'r'`,
      );
      return `PostgreSQL ${r?.versao ?? "?"} · schema painel com ${r?.tamanho ?? "?"}`;
    }),
    // Sempre vai ao Sankhya (sem cache): autentica se precisar e roda uma consulta mínima
    timed(async () => {
      await query("SELECT 1 AS OK", { ttlMs: 0 });
      return "API oficial (OAuth + DbExplorer) respondendo";
    }),
  ]);
  return { postgres, sankhya };
}

/** Configuração: o que está faltando nas variáveis de ambiente (sem mostrar valores). */
export function configChecks() {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return [
    { nome: "Banco do painel (DATABASE_URL)", ok: has("DATABASE_URL") },
    { nome: "Sankhya: aplicação OAuth (SANKHYA_CLIENT_ID/SECRET)", ok: has("SANKHYA_CLIENT_ID") && has("SANKHYA_CLIENT_SECRET") },
    { nome: "Sankhya: token do usuário de integração (SANKHYA_X_TOKEN)", ok: has("SANKHYA_X_TOKEN") },
    { nome: "Segredo das sessões (SESSION_SECRET)", ok: (process.env.SESSION_SECRET ?? "").length >= 32 },
    { nome: "Login de admin (ADMIN_USER/ADMIN_PASSWORD, 10+ caracteres)", ok: has("ADMIN_USER") && (process.env.ADMIN_PASSWORD ?? "").length >= 10 },
  ];
}

export function serverInfo() {
  const mem = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  const tempos = [...monitor.sankhya.tempos].sort((a, b) => a - b);
  const pct = (p: number) => (tempos.length ? tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * p))] : 0);
  return {
    noArDesde: monitor.inicio,
    memoriaMb: mb(mem.rss),
    heapMb: mb(mem.heapUsed),
    node: process.version,
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
    instancia: process.env.RENDER_INSTANCE_ID ?? null,
    sankhya: {
      ...monitor.sankhya,
      medio: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
      p95: pct(0.95),
    },
    logins: monitor.logins,
  };
}

export interface Usage {
  logins_hoje: number;
  logins_7d: number;
  pessoas_7d: number;
  erros_24h: number;
  alertas_24h: number;
  avisos_7d: number;
  sugestoes_pendentes: number;
  fila_hoje: number;
  fila_atendendo: number;
  lojas_com_meta: number;
  masters: number;
  lembretes_ativos: number;
  fotos: number;
}

const HOJE = `(date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')`;

/** Uso pelo banco (acessos vêm das linhas "[login] ok" gravadas em painel.evento). */
export async function usageStats() {
  const [r] = await sql<Usage>(
    `SELECT
       (SELECT count(*) FROM painel.evento WHERE mensagem LIKE '[login] ok %' AND criado_em >= ${HOJE})::int AS logins_hoje,
       (SELECT count(*) FROM painel.evento WHERE mensagem LIKE '[login] ok %' AND criado_em >= now() - interval '7 days')::int AS logins_7d,
       (SELECT count(DISTINCT split_part(substr(mensagem, 12), ' — ', 1)) FROM painel.evento
         WHERE mensagem LIKE '[login] ok %' AND criado_em >= now() - interval '7 days')::int AS pessoas_7d,
       (SELECT count(*) FROM painel.evento WHERE nivel = 'error' AND criado_em >= now() - interval '24 hours')::int AS erros_24h,
       (SELECT count(*) FROM painel.evento WHERE nivel = 'warn' AND criado_em >= now() - interval '24 hours')::int AS alertas_24h,
       (SELECT count(*) FROM painel.aviso WHERE criado_em >= now() - interval '7 days')::int AS avisos_7d,
       (SELECT count(*) FROM painel.feedback WHERE NOT concluido)::int AS sugestoes_pendentes,
       (SELECT count(*) FROM painel.fila WHERE dia = (now() AT TIME ZONE 'America/Sao_Paulo' - interval '7 hours')::date)::int AS fila_hoje,
       (SELECT count(*) FROM painel.fila WHERE atendendo AND dia = (now() AT TIME ZONE 'America/Sao_Paulo' - interval '7 hours')::date)::int AS fila_atendendo,
       (SELECT count(DISTINCT codemp) FROM painel.meta WHERE mes = date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS lojas_com_meta,
       (SELECT count(*) FROM painel.usuario_master)::int AS masters,
       (SELECT count(*) FROM painel.lembrete WHERE ativo)::int AS lembretes_ativos,
       (SELECT count(*) FROM painel.foto)::int AS fotos`,
  );
  return r;
}

/** Logs: do banco (30 dias: erros, alertas e acessos) ou da memória (todos, desde o último reinício). */
export async function searchLogs(fonte: "banco" | "memoria", q: string, nivel: Nivel | "todos", limite = 200): Promise<LogEntry[]> {
  const termo = q.trim().toLowerCase();
  if (fonte === "memoria") {
    return monitor.logs
      .filter((l) => (nivel === "todos" || l.nivel === nivel) && (!termo || l.msg.toLowerCase().includes(termo)))
      .slice(-limite)
      .reverse();
  }
  const rows = await sql<{ at: number; nivel: Nivel; msg: string }>(
    `SELECT (extract(epoch FROM criado_em) * 1000)::float8 AS at, nivel, mensagem AS msg FROM painel.evento
      WHERE ($1 = 'todos' OR nivel = $1) AND ($2 = '' OR mensagem ILIKE '%' || $2 || '%')
      ORDER BY criado_em DESC LIMIT $3`,
    [nivel, termo, limite],
  );
  return rows;
}

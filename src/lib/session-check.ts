import "server-only";
import { sql } from "./db";
import { query } from "./sankhya/client";
import { int } from "./sankhya/sql";
import { userKey, type Session } from "./session";

// Revalida quem já entrou: master excluído pelo admin, funcionário demitido ou vendedor inativado
// no Sankhya perde o acesso em até TTL_MS, sem esperar a sessão vencer.
const TTL_MS = 5 * 60 * 1000;
// Sankhya ou banco fora do ar: não derruba ninguém e tenta de novo depois deste intervalo
const ERROR_TTL_MS = 60 * 1000;

// Em globalThis: o proxy e as actions podem carregar este módulo separadamente no mesmo processo
const g = globalThis as unknown as { __painelSessaoAtiva?: Map<string, { ativo: boolean; expiresAt: number }> };
const cache = (g.__painelSessaoAtiva ??= new Map());

async function lookup(s: Session): Promise<boolean> {
  if (s.role === "admin") return true;
  if (s.role === "master") {
    if (!s.masterId) return false;
    const rows = await sql(`SELECT 1 FROM painel.usuario_master WHERE id = $1`, [s.masterId]);
    return rows.length > 0;
  }
  // As mesmas condições do login (src/lib/sankhya/profile.ts): funcionário ativo e vendedor ativo;
  // o gerente precisa continuar como gerente/supervisor (TIPVEND S ou G) da mesma loja
  const rows = await query(
    `SELECT 1 AS OK
       FROM TFPFUN FUN
       JOIN TGFVEN VEN ON VEN.CODVEND = ${int(s.codvend)} AND VEN.ATIVO = 'S'
      WHERE FUN.CODFUNC = ${int(s.codfunc)}
        AND FUN.CODEMP = ${int(s.codemp)}
        AND FUN.SITUACAO <> 0
        AND FUN.DTDEM IS NULL
        ${s.role === "gerente" ? "AND VEN.CODFUNC = FUN.CODFUNC AND VEN.CODEMP = FUN.CODEMP AND VEN.TIPVEND IN ('S', 'G')" : ""}`,
    { ttlMs: 0 },
  );
  return rows.length > 0;
}

/** Se quem está na sessão ainda tem acesso ao painel (resultado guardado por alguns minutos). */
export async function stillActive(s: Session): Promise<boolean> {
  const key = userKey(s);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.ativo;

  let ativo = true;
  let ttl = TTL_MS;
  try {
    ativo = await lookup(s);
  } catch (err) {
    console.error(`[sessao] não foi possível revalidar ${s.apelido} (${s.role}):`, err instanceof Error ? err.message : err);
    ttl = ERROR_TTL_MS;
  }
  cache.set(key, { ativo, expiresAt: now + ttl });
  if (cache.size > 5_000) {
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
  }
  return ativo;
}

/** Esquece o resultado guardado (ex.: master excluído agora perde o acesso no próximo clique). */
export function forgetActive(key: string) {
  cache.delete(key);
}

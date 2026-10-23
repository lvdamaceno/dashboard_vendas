import "server-only";
import { env } from "../env";

/** REJECTED = o Sankhya respondeu e recusou a operação (status "0") */
export type SankhyaErrorCode = "SESSION_EXPIRED" | "REJECTED" | "SERVICE" | "NETWORK";

export class SankhyaError extends Error {
  constructor(
    message: string,
    public code: SankhyaErrorCode,
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;

type ServiceResponse = {
  status?: string;
  statusMessage?: string;
  tsError?: { tsErrorCode?: string };
  responseBody?: any;
};

// Só loga serviço, status e mensagem do Sankhya — nunca credenciais
function logFailure(serviceName: string, started: number, detail: string) {
  console.error(`[sankhya] ${serviceName} falhou em ${Date.now() - started}ms: ${detail}`);
}

/** O Sankhya responde em ISO-8859-1; respeita o charset do cabeçalho. */
async function decodeBody(res: Response) {
  const charset = /charset=([^;]+)/i.exec(res.headers.get("content-type") ?? "")?.[1]?.trim() || "utf-8";
  const buf = await res.arrayBuffer();
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

// --- token OAuth da API oficial (gateway), reaproveitado entre requisições ---
// O token pertence ao usuário de integração configurado no Sankhya (Configurações Gateway);
// todas as consultas rodam com ele.
let token: Promise<{ value: string; expiresAt: number }> | undefined;

async function authenticate() {
  const { SANKHYA_API_URL, SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET, SANKHYA_X_TOKEN } = env();
  const url = new URL("/authenticate", SANKHYA_API_URL);
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Token": SANKHYA_X_TOKEN },
      body: new URLSearchParams({
        client_id: SANKHYA_CLIENT_ID,
        client_secret: SANKHYA_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    logFailure("authenticate", started, `sem conexão com ${url.origin} — ${String(err)}`);
    throw new SankhyaError("Não foi possível conectar ao Sankhya.", "NETWORK");
  }
  if (!res.ok) {
    // Nunca loga o corpo da requisição (contém o client_secret)
    logFailure("authenticate", started, `HTTP ${res.status} ${(await decodeBody(res)).slice(0, 200)} (verifique SANKHYA_CLIENT_ID/SECRET e SANKHYA_X_TOKEN)`);
    throw new SankhyaError("Falha na autenticação com a API do Sankhya.", "SERVICE");
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    logFailure("authenticate", started, "resposta sem access_token");
    throw new SankhyaError("Falha na autenticação com a API do Sankhya.", "SERVICE");
  }
  // Renova 30s antes de expirar
  return { value: data.access_token, expiresAt: Date.now() + Math.max((data.expires_in ?? 300) - 30, 10) * 1000 };
}

async function getToken(forceNew = false) {
  const current = token && (await token.catch(() => undefined));
  if (forceNew || !current || Date.now() >= current.expiresAt) {
    token = authenticate();
    token.catch(() => (token = undefined));
  }
  return (await token!).value;
}

async function callService(serviceName: string, requestBody: unknown, accessToken: string) {
  const url = new URL("/gateway/v1/mge/service.sbr", env().SANKHYA_API_URL);
  url.searchParams.set("serviceName", serviceName);
  url.searchParams.set("outputType", "json");

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ serviceName, requestBody }),
      cache: "no-store",
      // Um redirect transformaria o POST em GET; melhor falhar com uma mensagem clara
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    logFailure(
      serviceName,
      started,
      `sem conexão com ${url.origin} — ${cause?.code ?? ""} ${cause?.message ?? String(err)}`.trim(),
    );
    throw new SankhyaError("Não foi possível conectar ao Sankhya.", "NETWORK");
  }

  if (res.status >= 300 && res.status < 400) {
    logFailure(serviceName, started, `HTTP ${res.status} redirecionando para ${res.headers.get("location")} — ajuste SANKHYA_API_URL`);
    throw new SankhyaError("Endereço do Sankhya mal configurado.", "SERVICE");
  }
  if (res.status === 401 || res.status === 403) {
    logFailure(serviceName, started, `HTTP ${res.status}`);
    throw new SankhyaError("Sessão do Sankhya expirada.", "SESSION_EXPIRED");
  }
  if (!res.ok) {
    logFailure(serviceName, started, `HTTP ${res.status} ${res.statusText}`);
    throw new SankhyaError(`Sankhya respondeu HTTP ${res.status}.`, "SERVICE");
  }

  const text = await decodeBody(res);
  let data: ServiceResponse;
  try {
    data = JSON.parse(text);
  } catch {
    logFailure(serviceName, started, `resposta não é JSON: ${text.slice(0, 200)}`);
    throw new SankhyaError("Resposta inválida do Sankhya.", "SERVICE");
  }

  if (data.status === "1") return data.responseBody;
  const detail = `status ${data.status} ${data.tsError?.tsErrorCode ?? ""} "${data.statusMessage ?? ""}"`;
  logFailure(serviceName, started, detail);
  if (data.status === "3") throw new SankhyaError("Sessão do Sankhya expirada.", "SESSION_EXPIRED");
  throw new SankhyaError(data.statusMessage || "Erro no serviço do Sankhya.", "REJECTED");
}

async function executeQuery(sql: string, accessToken: string): Promise<Row[]> {
  const body = await callService("DbExplorerSP.executeQuery", { sql }, accessToken);
  const fields: { name: string }[] = body?.fieldsMetadata ?? [];
  const rows: unknown[][] = body?.rows ?? [];
  return rows.map((row) => Object.fromEntries(fields.map((f, i) => [f.name.toUpperCase(), row[i]])));
}

async function run(sql: string): Promise<Row[]> {
  try {
    return await executeQuery(sql, await getToken());
  } catch (err) {
    if (err instanceof SankhyaError && err.code === "SESSION_EXPIRED") {
      return executeQuery(sql, await getToken(true));
    }
    throw err;
  }
}

// --- cache curto das consultas ---
// Cada ida ao Sankhya leva de 0,2 s a 1 s. Guardar o resultado por pouco tempo deixa instantâneo
// voltar a um período já visto, recarregar o app e abrir de novo. A chave é o SQL inteiro, que já
// traz o escopo da pessoa (loja/vendedor): ninguém recebe o resultado de outro escopo.
// Consultas iguais ao mesmo tempo viram uma só. Erros não ficam guardados.
const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { expiresAt: number; rows: Promise<Row[]> }>();

/**
 * Executa uma consulta pela API oficial com o usuário de integração (o único com
 * acesso ao DbExplorer). O SQL é sempre montado no servidor — o navegador nunca envia SQL —
 * e quem chama é responsável por aplicar o escopo do usuário (ver sales.ts).
 * ttlMs: por quanto tempo reaproveitar o resultado (0 = sempre buscar de novo).
 */
export async function query(sql: string, { ttlMs = DEFAULT_TTL_MS }: { ttlMs?: number } = {}): Promise<Row[]> {
  if (ttlMs <= 0) return run(sql);
  const now = Date.now();
  const hit = cache.get(sql);
  if (hit && hit.expiresAt > now) return hit.rows;

  const rows = run(sql);
  cache.set(sql, { expiresAt: now + ttlMs, rows });
  rows.catch(() => cache.delete(sql));
  if (cache.size > MAX_ENTRIES) {
    for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
    // Ainda cheio: descarta os mais antigos (o Map mantém a ordem de inserção)
    for (const key of cache.keys()) {
      if (cache.size <= MAX_ENTRIES) break;
      cache.delete(key);
    }
  }
  return rows;
}

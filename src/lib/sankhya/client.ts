import "server-only";
import { env } from "../env";

/** REJECTED = o Sankhya respondeu e recusou a operação (status "0") */
export type SankhyaErrorCode = "INVALID_CREDENTIALS" | "SESSION_EXPIRED" | "REJECTED" | "SERVICE" | "NETWORK";

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

// Nunca loga o corpo da requisição (contém senha) — só serviço, status e mensagem do Sankhya
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

async function callService(serviceName: string, requestBody: unknown, jsessionid?: string) {
  const url = new URL("/mge/service.sbr", env().SANKHYA_URL);
  url.searchParams.set("serviceName", serviceName);
  url.searchParams.set("outputType", "json");
  if (jsessionid) url.searchParams.set("mgeSession", jsessionid);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jsessionid ? { Cookie: `JSESSIONID=${jsessionid}` } : {}),
      },
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
      `sem conexão com ${url.origin} — ${cause?.code ?? ""} ${cause?.message ?? String(err)}`.trim() +
        " (verifique SANKHYA_URL e se o firewall do servidor Sankhya libera os IPs de saída do Render)",
    );
    throw new SankhyaError("Não foi possível conectar ao Sankhya.", "NETWORK");
  }

  if (res.status >= 300 && res.status < 400) {
    logFailure(serviceName, started, `HTTP ${res.status} redirecionando para ${res.headers.get("location")} — ajuste SANKHYA_URL para esse endereço`);
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

/** Autentica no Sankhya e devolve o JSESSIONID. */
export async function sankhyaLogin(username: string, password: string): Promise<string> {
  try {
    const body = await callService("MobileLoginSP.login", {
      NOMUSU: { $: username },
      INTERNO: { $: password },
      KEEPCONNECTED: { $: "S" },
    });
    const jsessionid = body?.jsessionid?.$;
    if (!jsessionid) throw new SankhyaError("Login sem sessão retornada.", "SERVICE");
    return jsessionid;
  } catch (err) {
    // status "0" no login = usuário/senha inválidos (ou usuário bloqueado); o motivo exato já foi logado
    if (err instanceof SankhyaError && err.code === "REJECTED") {
      throw new SankhyaError("Usuário ou senha inválidos.", "INVALID_CREDENTIALS");
    }
    throw err;
  }
}

export async function sankhyaLogout(jsessionid: string) {
  await callService("MobileLoginSP.logout", {}, jsessionid).catch(() => undefined);
}

async function executeQuery(sql: string, jsessionid: string): Promise<Row[]> {
  const body = await callService("DbExplorerSP.executeQuery", { sql }, jsessionid);
  const fields: { name: string }[] = body?.fieldsMetadata ?? [];
  const rows: unknown[][] = body?.rows ?? [];
  return rows.map((row) => Object.fromEntries(fields.map((f, i) => [f.name.toUpperCase(), row[i]])));
}

// --- sessão da conta de integração (reaproveitada entre requisições) ---
let serviceSession: Promise<string> | undefined;

function getServiceSession(forceNew = false) {
  if (forceNew || !serviceSession) {
    const { SANKHYA_SERVICE_USER, SANKHYA_SERVICE_PASSWORD } = env();
    serviceSession = sankhyaLogin(SANKHYA_SERVICE_USER!, SANKHYA_SERVICE_PASSWORD!);
    serviceSession.catch(() => (serviceSession = undefined));
  }
  return serviceSession;
}

/**
 * Executa uma consulta com a conta de integração (a única com acesso ao
 * DbExplorer). O SQL é sempre montado no servidor — o navegador nunca envia SQL —
 * e quem chama é responsável por aplicar o escopo do usuário (ver sales.ts).
 */
export async function query(sql: string): Promise<Row[]> {
  try {
    return await executeQuery(sql, await getServiceSession());
  } catch (err) {
    if (err instanceof SankhyaError && err.code === "SESSION_EXPIRED") {
      return executeQuery(sql, await getServiceSession(true));
    }
    throw err;
  }
}

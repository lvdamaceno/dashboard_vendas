import "server-only";
import { env } from "../env";

export type SankhyaErrorCode = "INVALID_CREDENTIALS" | "SESSION_EXPIRED" | "SERVICE" | "NETWORK";

export class SankhyaError extends Error {
  constructor(
    message: string,
    public code: SankhyaErrorCode,
  ) {
    super(message);
  }
}

type Row = Record<string, unknown>;

async function callService(serviceName: string, requestBody: unknown, jsessionid?: string) {
  const url = new URL("/mge/service.sbr", env().SANKHYA_URL);
  url.searchParams.set("serviceName", serviceName);
  url.searchParams.set("outputType", "json");
  if (jsessionid) url.searchParams.set("mgeSession", jsessionid);

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
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error(`[sankhya] falha de rede em ${serviceName}`, err);
    throw new SankhyaError("Não foi possível conectar ao Sankhya.", "NETWORK");
  }

  if (res.status === 401 || res.status === 403) {
    throw new SankhyaError("Sessão do Sankhya expirada.", "SESSION_EXPIRED");
  }
  if (!res.ok) {
    throw new SankhyaError(`Sankhya respondeu HTTP ${res.status}.`, "SERVICE");
  }

  const data = (await res.json().catch(() => null)) as
    | { status?: string; statusMessage?: string; responseBody?: any }
    | null;
  if (!data) throw new SankhyaError("Resposta inválida do Sankhya.", "SERVICE");

  if (data.status === "1") return data.responseBody;
  if (data.status === "3") throw new SankhyaError("Sessão do Sankhya expirada.", "SESSION_EXPIRED");
  throw new SankhyaError(data.statusMessage || "Erro no serviço do Sankhya.", "SERVICE");
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
    // status "0" no login = usuário/senha inválidos (ou usuário bloqueado)
    if (err instanceof SankhyaError && err.code === "SERVICE") {
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

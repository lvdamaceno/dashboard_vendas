import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";
import { env } from "./env";

const baseSchema = z.object({
  /** Funcionário (TFPFUN) de quem entrou; 0 para master e admin */
  codfunc: z.number().int(),
  nome: z.string(),
  /** Vendedor (TGFVEN); 0 para master e admin */
  codvend: z.number().int().nonnegative(),
  apelido: z.string(),
  /** master: diretor (CPF cadastrado pelo admin); admin: entra com usuário e senha */
  role: z.enum(["vendedor", "gerente", "master", "admin"]),
  /** Empresa do funcionário; para o gerente, a loja cujas vendas ele vê; 0 = todas as lojas */
  codemp: z.number().int(),
  /** painel.usuario_master.id */
  masterId: z.number().int().positive().optional(),
});

const sessionSchema = baseSchema.extend({
  /** Admin vendo o painel de um vendedor ou gerente */
  como: baseSchema.extend({ role: z.enum(["vendedor", "gerente"]) }).optional(),
});

export type Session = z.infer<typeof sessionSchema>;
export type ViewAs = NonNullable<Session["como"]>;

/** Quem tem visão de loja (ranking, equipe, margem): gerente, master e admin. */
export const isManagerial = (s: Session) => s.role !== "vendedor";
/** Master e admin escolhem a loja (ou todas). */
export const seesAllStores = (s: Session) => s.role === "master" || s.role === "admin";

/** Sessão usada nas consultas: a do vendedor/gerente que o admin escolheu, se houver. */
export const viewSession = (s: Session): Session => (s.role === "admin" && s.como ? s.como : s);

/** Chave do usuário nas tabelas do painel (ex.: avisos já vistos). */
export function userKey(s: Session) {
  if (s.role === "admin") return "admin";
  if (s.role === "master") return `m:${s.masterId}`;
  return `f:${s.codemp}:${s.codfunc}:${s.codvend}`;
}

const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-dv_session" : "dv_session";

/**
 * Opções para apagar o cookie de sessão. O prefixo __Host- exige Secure e Path=/ também
 * na exclusão; sem isso o navegador ignora e a pessoa continua logada depois de sair.
 */
export const CLEAR_SESSION_COOKIE = { name: SESSION_COOKIE, value: "", httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 } as const;

let keyPromise: Promise<Uint8Array> | undefined;

// Deriva uma chave de 256 bits a partir do segredo configurado
function key() {
  keyPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(env().SESSION_SECRET))
    .then((buf) => new Uint8Array(buf));
  return keyPromise;
}

export async function encryptSession(session: Session) {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${env().SESSION_TTL_HOURS}h`)
    .encrypt(await key());
}

export async function decryptSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await key());
    const parsed = sessionSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encryptSession(session), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env().SESSION_TTL_HOURS * 3600,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(CLEAR_SESSION_COOKIE);
}

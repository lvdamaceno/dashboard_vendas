import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";
import { env } from "./env";

const sessionSchema = z.object({
  /** Funcionário (TFPFUN) de quem entrou */
  codfunc: z.number().int(),
  nome: z.string(),
  codvend: z.number().int().positive(),
  apelido: z.string(),
  role: z.enum(["vendedor", "gerente"]),
  /** Empresa do funcionário; para o gerente, a loja cujas vendas ele vê */
  codemp: z.number().int(),
});

export type Session = z.infer<typeof sessionSchema>;

const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProd ? "__Host-dv_session" : "dv_session";

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
  store.delete(SESSION_COOKIE);
}

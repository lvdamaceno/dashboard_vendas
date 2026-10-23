import type { BrowserContext } from "@playwright/test";
import { EncryptJWT } from "jose";
import { Client } from "pg";
import { E2E_SECRET } from "../../playwright.config";

export const ANA = { codfunc: 1, nome: "ANA PAULA SOUZA", codvend: 901, apelido: "ANA PAULA", role: "vendedor", codemp: 1 } as const;
export const BRUNO = { codfunc: 2, nome: "BRUNO", codvend: 902, apelido: "BRUNO", role: "vendedor", codemp: 1 } as const;
export const MARCOS = { codfunc: 9, nome: "MARCOS LIMA", codvend: 950, apelido: "MARCOS", role: "gerente", codemp: 1 } as const;

/** Entra direto com uma sessão (como o login faria), para testar a tela sem passar pelo Sankhya. */
export async function loginAs(context: BrowserContext, session: object) {
  const key = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(E2E_SECRET)));
  const value = await new EncryptJWT({ ...session }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("1h").encrypt(key);
  await context.addCookies([{ name: "__Host-dv_session", value, url: "https://localhost:3123", secure: true, httpOnly: true, sameSite: "Lax" }]);
}

/** Consulta/limpa o Postgres de teste. */
export async function db<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export const DIA_FILA = `(now() AT TIME ZONE 'America/Sao_Paulo' - interval '7 hours')::date`;

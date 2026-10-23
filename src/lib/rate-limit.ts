import "server-only";
import { headers } from "next/headers";

/** IP de quem fez a requisição. No Render (Cloudflare na frente) o IP real vem em True-Client-IP. */
export async function clientIp() {
  const h = await headers();
  return h.get("true-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// Limitador em memória para tentativas de login (suficiente para uma instância;
// com várias instâncias, troque por Redis ou limite no proxy reverso).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function isBlocked(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
  }
}

export function clearFailures(key: string) {
  attempts.delete(key);
}

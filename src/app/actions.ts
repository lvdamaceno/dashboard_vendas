"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearFailures, isBlocked, registerFailure } from "@/lib/rate-limit";
import { fetchProfile, ProfileError } from "@/lib/sankhya/profile";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string; cpf?: string };

/** CPF só com dígitos e dígitos verificadores corretos. */
function validCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

// Não grava o CPF completo nos logs
const masked = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = typeof form.get("cpf") === "string" ? String(form.get("cpf")).slice(0, 20) : "";
  const cpf = raw.replace(/\D/g, "");
  if (!validCpf(cpf)) return { error: "Informe um CPF válido.", cpf: raw };

  // No Render (Cloudflare na frente) o IP real vem em True-Client-IP
  const h = await headers();
  const ip = h.get("true-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const keys = [`ip:${ip}`, `cpf:${cpf}`];
  if (keys.some(isBlocked)) {
    console.warn(`[login] bloqueado por excesso de tentativas: ${masked(cpf)} (ip ${ip})`);
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.", cpf: raw };
  }

  try {
    const profile = await fetchProfile(cpf);
    await createSession(profile);
    console.info(`[login] ok ${profile.nome} — ${profile.role}, vendedor ${profile.codvend}, empresa ${profile.codemp ?? "-"}`);
  } catch (err) {
    if (err instanceof ProfileError) {
      console.warn(`[login] ${masked(cpf)} sem acesso: ${err.message} (ip ${ip})`);
      keys.forEach(registerFailure);
      return { error: err.message, cpf: raw };
    }
    console.error(`[login] erro ao carregar perfil de ${masked(cpf)}:`, err instanceof Error ? err.message : err);
    return { error: "Não foi possível conectar ao Sankhya. Tente novamente.", cpf: raw };
  }

  keys.forEach(clearFailures);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearFailures, isBlocked, registerFailure } from "@/lib/rate-limit";
import { SankhyaError, sankhyaLogin, sankhyaLogout } from "@/lib/sankhya/client";
import { fetchProfile, ProfileError } from "@/lib/sankhya/profile";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string; username?: string };

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[\p{L}\p{N}._@-]+$/u),
  password: z.string().min(1).max(128),
});

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({ username: form.get("username"), password: form.get("password") });
  const username = typeof form.get("username") === "string" ? String(form.get("username")).slice(0, 60) : "";
  if (!parsed.success) return { error: "Informe usuário e senha válidos.", username };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const keys = [`ip:${ip}`, `user:${parsed.data.username.toUpperCase()}`];
  if (keys.some(isBlocked)) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.", username };
  }

  let jsessionid: string;
  try {
    jsessionid = await sankhyaLogin(parsed.data.username, parsed.data.password);
  } catch (err) {
    if (err instanceof SankhyaError && err.code === "INVALID_CREDENTIALS") {
      keys.forEach(registerFailure);
      return { error: "Usuário ou senha inválidos.", username };
    }
    console.error("[login]", err);
    return { error: "Não foi possível conectar ao Sankhya. Tente novamente.", username };
  }

  // A sessão do usuário só serve para validar a senha; as consultas usam a conta de integração.
  await sankhyaLogout(jsessionid);

  try {
    await createSession(await fetchProfile(parsed.data.username));
  } catch (err) {
    if (err instanceof ProfileError) return { error: err.message, username };
    console.error("[login]", err);
    return { error: "Não foi possível carregar seu perfil no Sankhya.", username };
  }

  keys.forEach(clearFailures);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

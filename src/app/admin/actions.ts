"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { addMaster, deleteNotice, removeMaster, setFeedbackDone } from "@/lib/painel";
import { clearFailures, clientIp, isBlocked, registerFailure } from "@/lib/rate-limit";
import { personView } from "@/lib/sales";
import { createSession, getSession, type Session } from "@/lib/session";

export type AdminState = { error?: string; ok?: boolean };

// Compara sem vazar pelo tempo de resposta (hash deixa os dois do mesmo tamanho)
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function adminLogin(_prev: AdminState, form: FormData): Promise<AdminState> {
  const { ADMIN_USER, ADMIN_PASSWORD } = env();
  if (!ADMIN_USER || !ADMIN_PASSWORD) return { error: "Acesso de admin não configurado." };
  if (ADMIN_PASSWORD.length < 12) {
    console.error("[admin] ADMIN_PASSWORD precisa ter ao menos 12 caracteres; acesso de admin desligado");
    return { error: "Acesso de admin mal configurado. Veja os logs do servidor." };
  }

  const ip = await clientIp();
  const key = `admin:${ip}`;
  if (isBlocked(key)) return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };

  const user = String(form.get("usuario") ?? "").slice(0, 100);
  const password = String(form.get("senha") ?? "").slice(0, 200);
  // Avalia os dois sempre, para não revelar qual deles está errado
  const ok = [same(user, ADMIN_USER), same(password, ADMIN_PASSWORD)].every(Boolean);
  if (!ok) {
    registerFailure(key);
    console.warn(`[admin] login recusado (ip ${ip})`);
    return { error: "Usuário ou senha incorretos." };
  }

  clearFailures(key);
  await createSession({ role: "admin", nome: "Administrador", apelido: "Admin", codfunc: 0, codvend: 0, codemp: 0 });
  console.info(`[admin] login ok (ip ${ip})`);
  redirect("/admin");
}

/** Toda ação daqui exige sessão de admin. */
async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");
  return session;
}

const id = z.coerce.number().int().positive();

export async function toggleFeedback(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await setFeedbackDone(parsed.data, form.get("concluido") === "1");
  refresh();
}

export async function removeNotice(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await deleteNotice(parsed.data);
  refresh();
}

const masterSchema = z.object({
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{11}$/.test(v), "CPF precisa ter 11 dígitos"),
  nome: z.string().trim().min(1, "Informe o nome").max(120),
});

export async function saveMaster(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const parsed = masterSchema.safeParse({ cpf: String(form.get("cpf") ?? ""), nome: String(form.get("nome") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    await addMaster(parsed.data.cpf, parsed.data.nome);
    console.info(`[admin] master cadastrado: ${parsed.data.nome}`);
  } catch (err) {
    console.error("[admin] erro ao cadastrar master:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

export async function deleteMaster(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await removeMaster(parsed.data);
  console.info(`[admin] master ${parsed.data} removido`);
  refresh();
}

/** Admin passa a ver o painel de um vendedor ou gerente (escolhido pelo nome). */
export async function viewAs(form: FormData) {
  const session = await requireAdmin();
  const parsed = id.safeParse(form.get("codvend"));
  if (!parsed.success) return;
  const como = await personView(parsed.data);
  if (!como) return;
  const { como: _, ...admin } = session;
  await createSession({ ...admin, como });
  console.info(`[admin] vendo o painel de ${como.apelido} (${como.role}, vendedor ${como.codvend})`);
  redirect("/dashboard");
}

/** Volta para a visão de admin (todas as lojas). */
export async function stopViewAs() {
  const session = await requireAdmin();
  const { como: _, ...admin } = session;
  await createSession(admin);
  redirect("/dashboard");
}

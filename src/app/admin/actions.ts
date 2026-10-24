"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { addPlace, deletePlace, geocode, saveAccessRule, setPlaceActive, type Endereco, type Janela } from "@/lib/acesso";
import { env } from "@/lib/env";
import { createReminder, deleteReminder, setReminderActive } from "@/lib/lembretes";
import { addMaster, deleteNotice, getMaster, removeMaster, resetMasterPassword, setFeedbackDone } from "@/lib/painel";
import { clearFailures, clientIp, isBlocked, registerFailure } from "@/lib/rate-limit";
import { personView } from "@/lib/sales";
import { cookies } from "next/headers";
import { ADMIN_HINT, createSession, getSession, type Session, type ViewAs } from "@/lib/session";

/** usuario: devolvido no erro de login para o campo não ficar vazio (o React limpa o formulário depois da ação) */
export type AdminState = { error?: string; ok?: boolean; usuario?: string };

// Compara sem vazar pelo tempo de resposta (hash deixa os dois do mesmo tamanho)
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function adminLogin(_prev: AdminState, form: FormData): Promise<AdminState> {
  const { ADMIN_USER, ADMIN_PASSWORD } = env();
  if (!ADMIN_USER || !ADMIN_PASSWORD) return { error: "Acesso de admin não configurado." };
  if (ADMIN_PASSWORD.length < 10) {
    console.error("[admin] ADMIN_PASSWORD precisa ter ao menos 10 caracteres; acesso de admin desligado");
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
    return { error: "Usuário ou senha incorretos.", usuario: user };
  }

  clearFailures(key);
  // Substitui a sessão que estiver aberta no aparelho (ex.: de um gerente)
  await createSession({ role: "admin", nome: "Administrador", apelido: "Admin", codfunc: 0, codvend: 0, codemp: 0 });
  (await cookies()).set(ADMIN_HINT);
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

/** Visão de um master: todas as lojas, como a diretoria vê. */
async function masterView(masterId: number): Promise<ViewAs | null> {
  const master = await getMaster(masterId);
  if (!master) return null;
  const apelido = master.nome.trim().split(/\s+/)[0];
  return { role: "master", masterId: master.id, nome: master.nome, apelido, codfunc: 0, codvend: 0, codemp: 0 };
}

/** Admin passa a ver o painel de um vendedor, gerente ou master (escolhido pelo nome). */
export async function viewAs(form: FormData) {
  const session = await requireAdmin();
  const parsed = id.safeParse(form.get("codigo"));
  if (!parsed.success) return;
  // Sempre relido da fonte (Sankhya ou banco do painel), nunca dos dados do formulário
  const como = form.get("tipo") === "master" ? await masterView(parsed.data) : await personView(parsed.data);
  if (!como) return;
  const { como: _, ...admin } = session;
  await createSession({ ...admin, como });
  console.info(`[admin] vendo o painel de ${como.apelido} (${como.role})`);
  redirect("/dashboard");
}

/** Volta para a visão de admin (todas as lojas). */
export async function stopViewAs() {
  const session = await requireAdmin();
  const { como: _, ...admin } = session;
  await createSession(admin);
  redirect("/dashboard");
}

// --- lembretes recorrentes (viram avisos no sino do público escolhido) ---

const reminderSchema = z
  .object({
    titulo: z.string().trim().min(1, "Informe o título").max(120),
    mensagem: z.string().trim().min(1, "Escreva a mensagem").max(2000),
    publico: z.enum(["master", "gerente", "vendedor", "todos"]),
    recorrencia: z.enum(["mensal", "semanal", "diaria", "unica"]),
    diaMes: z.coerce.number().int().min(1).max(31).optional(),
    diaSemana: z.coerce.number().int().min(0).max(6).optional(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((r) => r.recorrencia !== "mensal" || r.diaMes, "Escolha o dia do mês")
  .refine((r) => r.recorrencia !== "semanal" || r.diaSemana !== undefined, "Escolha o dia da semana")
  .refine((r) => r.recorrencia !== "unica" || r.data, "Escolha a data");

export async function addReminder(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const val = (k: string) => {
    const v = form.get(k);
    return v === null || v === "" ? undefined : String(v);
  };
  const parsed = reminderSchema.safeParse({
    titulo: val("titulo") ?? "",
    mensagem: val("mensagem") ?? "",
    publico: val("publico"),
    recorrencia: val("recorrencia"),
    diaMes: val("diaMes"),
    diaSemana: val("diaSemana"),
    data: val("data"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const r = parsed.data;
  try {
    await createReminder({
      titulo: r.titulo,
      mensagem: r.mensagem,
      publico: r.publico,
      recorrencia: r.recorrencia,
      dia: r.recorrencia === "mensal" ? r.diaMes! : r.recorrencia === "semanal" ? r.diaSemana! : null,
      data: r.recorrencia === "unica" ? r.data! : null,
    });
    console.info(`[admin] lembrete criado: "${r.titulo}" (${r.recorrencia}, ${r.publico})`);
  } catch (err) {
    console.error("[admin] erro ao criar lembrete:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

export async function toggleReminder(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await setReminderActive(parsed.data, form.get("ativo") === "1");
  refresh();
}

export async function removeReminder(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await deleteReminder(parsed.data);
  refresh();
}

/** Zera a senha de um master: no próximo acesso ele cria outra. */
export async function resetMasterPasswordAction(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await resetMasterPassword(parsed.data);
  console.info(`[admin] senha do master ${parsed.data} zerada`);
  refresh();
}

// --- horário e local de acesso por grupo ---

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");

export async function saveAccessRuleAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const session = await requireAdmin();
  const papel = z.enum(["vendedor", "gerente"]).safeParse(form.get("papel"));
  if (!papel.success) return { error: "Grupo inválido." };
  const janelas: (Janela | null)[] = [];
  for (let dia = 0; dia < 7; dia++) {
    if (form.get(`dia${dia}`) !== "1") {
      janelas.push(null);
      continue;
    }
    const inicio = hhmm.safeParse(form.get(`inicio${dia}`));
    const fim = hhmm.safeParse(form.get(`fim${dia}`));
    if (!inicio.success || !fim.success) return { error: "Preencha o início e o fim de cada dia marcado." };
    if (inicio.data >= fim.data) return { error: "Em cada dia, o fim precisa ser depois do início." };
    janelas.push({ inicio: inicio.data, fim: fim.data });
  }
  const horario = form.get("horario") === "1";
  const local = form.get("local") === "1";
  if (horario && janelas.every((j) => !j)) return { error: "Marque pelo menos um dia, ou desligue o limite de horário." };
  try {
    await saveAccessRule({ papel: papel.data, horario, janelas, local }, session.nome);
    console.info(`[admin] acesso de ${papel.data}: horário ${horario ? "limitado" : "livre"}, local ${local ? "exigido" : "livre"}`);
  } catch (err) {
    console.error("[admin] erro ao salvar regra de acesso:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

const placeSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do local").max(120),
  endereco: z.string().trim().max(300),
  lat: z.coerce.number({ message: "Informe a latitude" }).min(-90).max(90),
  lng: z.coerce.number({ message: "Informe a longitude" }).min(-180).max(180),
  raio: z.coerce.number().int().min(30).max(5000),
});

export async function addPlaceAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const val = (k: string) => String(form.get(k) ?? "").replace(",", ".").trim();
  const parsed = placeSchema.safeParse({ nome: form.get("nome") ?? "", endereco: form.get("endereco") ?? "", lat: val("lat") || undefined, lng: val("lng") || undefined, raio: val("raio") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const l = parsed.data;
  try {
    await addPlace({ ...l, endereco: l.endereco || null });
    console.info(`[admin] local de acesso cadastrado: ${l.nome} (raio ${l.raio} m)`);
  } catch (err) {
    console.error("[admin] erro ao cadastrar local:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

export async function togglePlace(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await setPlaceActive(parsed.data, form.get("ativo") === "1");
  refresh();
}

export async function removePlace(form: FormData) {
  await requireAdmin();
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) return;
  await deletePlace(parsed.data);
  console.info(`[admin] local de acesso ${parsed.data} removido`);
  refresh();
}

export type GeocodeResult = { ok: true; resultados: Endereco[] } | { ok: false; error: string };

/** Procura as coordenadas de um endereço (para o cadastro de local). */
export async function searchAddress(q: string): Promise<GeocodeResult> {
  await requireAdmin();
  const busca = String(q ?? "").trim().slice(0, 300);
  if (busca.length < 5) return { ok: false, error: "Digite o endereço completo (rua, número, bairro e cidade)." };
  try {
    const resultados = await geocode(busca);
    return resultados.length ? { ok: true, resultados } : { ok: false, error: "Endereço não encontrado. Tente escrever de outro jeito ou use a localização atual." };
  } catch (err) {
    console.error("[admin] erro ao procurar endereço:", err instanceof Error ? err.message : err);
    return { ok: false, error: "A busca de endereço não respondeu. Tente de novo ou informe as coordenadas." };
  }
}

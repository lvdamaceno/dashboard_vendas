"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { clearPhoneOverride, createFeedback, createNotice, dismissClient, getPhoneOverrides, markNoticesSeen, savePhoneOverride } from "@/lib/painel";
import { normalizePhone } from "@/lib/phone";
import { clientInScope, getTeamPhones, vendorStore } from "@/lib/sales";
import { getSession, seesAllStores, viewSession, type Session } from "@/lib/session";

// Avisos (sino) e sugestões/erros. Toda ação confere a sessão e o papel no servidor.

export type FormState = { ok?: boolean; error?: string };
/** telefone: o que ficou salvo no app (null = voltou a valer o do Sankhya) */
export type PhoneState = FormState & { telefone?: string | null };

const text = (max: number) => z.string().trim().min(1).max(max);

/** Marca os avisos como vistos ao abrir o sino. */
export async function seeNotices() {
  const session = await getSession();
  if (!session) return;
  try {
    await markNoticesSeen(session);
  } catch (err) {
    console.error("[avisos] erro ao marcar como vistos:", err instanceof Error ? err.message : err);
  }
}

const noticeSchema = z.object({
  titulo: text(120),
  mensagem: text(2000),
  // "" = todas as lojas
  loja: z.string().regex(/^\d{0,9}$/),
});

/**
 * Gerente avisa a própria loja; master e admin avisam uma loja ou todas.
 * Vendedor não envia avisos.
 */
export async function sendNotice(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session || session.role === "vendedor") return { error: "Você não pode enviar avisos." };

  const parsed = noticeSchema.safeParse({ titulo: form.get("titulo") ?? "", mensagem: form.get("mensagem") ?? "", loja: form.get("loja") ?? "" });
  if (!parsed.success) return { error: "Preencha o título (até 120 letras) e a mensagem (até 2000)." };

  const { titulo, mensagem, loja } = parsed.data;
  const codemp = seesAllStores(session) ? (loja ? Number(loja) : null) : session.codemp;
  try {
    await createNotice({ titulo, mensagem, codemp, autorNome: session.apelido, autorPapel: session.role });
    console.info(`[avisos] ${session.role} ${session.apelido} enviou aviso para ${codemp ? `a loja ${codemp}` : "todas as lojas"}`);
  } catch (err) {
    console.error("[avisos] erro ao enviar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível enviar o aviso. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

const feedbackSchema = z.object({
  tipo: z.enum(["sugestao", "erro"]),
  mensagem: text(4000),
  pagina: z.string().max(300),
  navegador: z.string().max(300),
});

export async function sendFeedback(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Entre novamente." };

  const parsed = feedbackSchema.safeParse({
    tipo: form.get("tipo"),
    mensagem: form.get("mensagem") ?? "",
    pagina: String(form.get("pagina") ?? "").slice(0, 300),
    navegador: String(form.get("navegador") ?? "").slice(0, 300),
  });
  if (!parsed.success) return { error: "Escolha o tipo e escreva a mensagem (até 4000 letras)." };

  try {
    await createFeedback({
      ...parsed.data,
      autorNome: session.nome || session.apelido,
      autorPapel: session.role,
      codemp: session.codemp || null,
      codvend: session.codvend || null,
    });
    console.info(`[sugestoes] ${parsed.data.tipo} de ${session.apelido} (${session.role})`);
  } catch (err) {
    console.error("[sugestoes] erro ao registrar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível enviar. Tente novamente." };
  }
  return { ok: true };
}

/**
 * Tira um cliente da lista "Clientes para chamar de volta" (ex.: avisou que não quer voltar).
 * Só vale para clientes que compraram dentro do que a pessoa pode ver; volta à lista se comprar de novo.
 */
export async function dismissLostClient(codparc: number): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Entre novamente." };
  if (!Number.isSafeInteger(codparc) || codparc <= 0) return { error: "Cliente inválido." };

  try {
    if (!(await clientInScope(viewSession(session), codparc))) return { error: "Cliente fora da sua carteira." };
    await dismissClient({
      codparc,
      autorNome: session.nome || session.apelido,
      autorPapel: session.role,
      codemp: session.codemp || null,
      codvend: session.codvend || null,
    });
    console.info(`[clientes] ${session.apelido} (${session.role}) tirou o cliente ${codparc} da lista de chamar de volta`);
  } catch (err) {
    console.error("[clientes] erro ao dispensar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível tirar da lista. Tente novamente." };
  }
  return { ok: true };
}

/**
 * Quem pode trocar o telefone de quem: o vendedor e o gerente, o próprio; o gerente, também
 * os vendedores da sua loja (TGFVEN.CODEMP); o admin, de todos. Master não tem cartão.
 */
async function canEditPhone(session: Session, codvend: number) {
  if (session.role === "master") return false;
  if (session.role !== "admin" && codvend === session.codvend) return true;
  if (session.role === "vendedor") return false;
  const loja = await vendorStore(codvend);
  return session.role === "admin" ? loja !== null : loja === session.codemp;
}

const phoneSchema = z.object({
  codvend: z.coerce.number().int().positive(),
  // "" = voltar a usar o telefone do Sankhya
  telefone: z.string().max(30),
});

/** Salva o telefone do cartão (WhatsApp/QR code) de um vendedor ou gerente; vazio volta ao do Sankhya. */
export async function savePhone(_prev: PhoneState, form: FormData): Promise<PhoneState> {
  const session = await getSession();
  if (!session) return { error: "Sessão expirada. Entre novamente." };
  const parsed = phoneSchema.safeParse({ codvend: form.get("codvend"), telefone: form.get("telefone") ?? "" });
  if (!parsed.success) return { error: "Dados inválidos." };

  const { codvend } = parsed.data;
  // Botão "Usar o do Sankhya" manda limpar=1
  const telefone = form.get("limpar") === "1" ? "" : normalizePhone(parsed.data.telefone);
  if (telefone === null) return { error: "Informe o celular com DDD, ex.: (11) 98765-4321." };

  try {
    if (!(await canEditPhone(session, codvend))) return { error: "Você não pode alterar este telefone." };
    if (telefone) await savePhoneOverride(codvend, telefone, session.nome || session.apelido, session.role);
    else await clearPhoneOverride(codvend);
    console.info(`[telefone] ${session.apelido} (${session.role}) ${telefone ? "atualizou" : "voltou ao Sankhya"} o telefone do vendedor ${codvend}`);
  } catch (err) {
    console.error("[telefone] erro ao salvar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  return { ok: true, telefone: telefone || null };
}

export interface EditablePhone {
  codvend: number;
  nome: string;
  role: "vendedor" | "gerente";
  codemp: number;
  sankhya: string | null;
  /** Telefone salvo pelo app (tem prioridade) */
  app: string | null;
}

/** Telefones que a pessoa pode editar: a equipe da loja (gerente) ou todos (admin). */
export async function listEditablePhones(): Promise<EditablePhone[] | { error: string }> {
  const session = await getSession();
  if (session?.role !== "gerente" && session?.role !== "admin") return { error: "Sem acesso." };
  try {
    return await editablePhones(session.role === "gerente" ? session.codemp : undefined);
  } catch (err) {
    console.error("[telefone] erro ao listar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível carregar os telefones. Tente novamente." };
  }
}

async function editablePhones(codemp?: number): Promise<EditablePhone[]> {
  const [people, overrides] = await Promise.all([getTeamPhones(codemp), getPhoneOverrides()]);
  return people.map((p) => ({ ...p, app: overrides.get(p.codvend)?.telefone ?? null }));
}

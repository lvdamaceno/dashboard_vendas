"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { deleteHolidayAdjustment, insertHolidayAdjustments, listHolidayAdjustments, saveHolidayAdjustment } from "@/lib/feriados";
import { getSession, type Session } from "@/lib/session";
import { holidays, type HolidayAdjustment } from "@/lib/workdays";

// Ajustes de feriado por cima do calendário de src/lib/workdays.ts; refletem nas metas diárias.
// Master e admin (quem define as metas) podem mexer.

export type HolidayState = { ok?: boolean; error?: string };

async function requireGoalManager(): Promise<Session> {
  const session = await getSession();
  if (session?.role !== "master" && session?.role !== "admin") redirect("/dashboard");
  return session;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const holidaySchema = z.object({
  dia: z.string().regex(ISO, "Escolha a data"),
  nome: z.string().trim().min(1, "Informe o nome do feriado").max(120),
});
const validDay = (dia: string) => {
  const d = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
};

/** Feriado novo (dia sem expediente). */
export async function addHoliday(_prev: HolidayState, form: FormData): Promise<HolidayState> {
  const session = await requireGoalManager();
  const parsed = holidaySchema.safeParse({ dia: form.get("dia") ?? "", nome: form.get("nome") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!validDay(parsed.data.dia)) return { error: "Data inválida." };
  try {
    await saveHolidayAdjustment({ ...parsed.data, fecha: true }, session.nome);
    console.info(`[feriados] ${session.apelido} criou ${parsed.data.dia} ${parsed.data.nome}`);
  } catch (err) {
    console.error("[feriados] erro ao salvar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

/** Feriado do calendário em que a loja abre: o dia volta a contar como útil. */
export async function openOnHoliday(form: FormData) {
  const session = await requireGoalManager();
  const parsed = holidaySchema.safeParse({ dia: form.get("dia") ?? "", nome: form.get("nome") ?? "" });
  if (!parsed.success || !validDay(parsed.data.dia)) return;
  await saveHolidayAdjustment({ ...parsed.data, fecha: false }, session.nome);
  console.info(`[feriados] ${session.apelido}: loja abre em ${parsed.data.dia}`);
  refresh();
}

/** Dia fora do expediente normal (ex.: domingo) em que a loja abre: passa a contar como dia útil. */
export async function addOpenDay(_prev: HolidayState, form: FormData): Promise<HolidayState> {
  const session = await requireGoalManager();
  const parsed = holidaySchema.safeParse({ dia: form.get("dia") ?? "", nome: String(form.get("nome") ?? "").trim() || "Loja aberta" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!validDay(parsed.data.dia)) return { error: "Data inválida." };
  try {
    await saveHolidayAdjustment({ ...parsed.data, fecha: false }, session.nome);
    console.info(`[feriados] ${session.apelido}: expediente em ${parsed.data.dia}`);
  } catch (err) {
    console.error("[feriados] erro ao salvar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

/** Desfaz o ajuste do dia (feriado criado some; feriado do calendário volta a fechar). */
export async function resetHoliday(form: FormData) {
  const session = await requireGoalManager();
  const dia = String(form.get("dia") ?? "");
  if (!ISO.test(dia)) return;
  await deleteHolidayAdjustment(dia);
  console.info(`[feriados] ${session.apelido} desfez o ajuste de ${dia}`);
  refresh();
}

/**
 * Copia os ajustes do ano anterior:
 *  - feriado criado → mesmo dia e mês (29/02 só em ano bissexto);
 *  - "loja abre" num feriado do calendário → a data desse feriado no ano novo (móveis como Corpus Christi mudam de dia).
 * Domingos (ou outros dias) com expediente avulso não são copiados: no ano seguinte cairiam em outro dia da semana.
 * Não sobrescreve o que já existe no ano de destino.
 */
export async function copyHolidays(_prev: HolidayState, form: FormData): Promise<HolidayState> {
  const session = await requireGoalManager();
  const ano = Number(form.get("ano"));
  if (!Number.isSafeInteger(ano) || ano < 2021 || ano > 2100) return { error: "Ano inválido." };
  try {
    const anteriores = await listHolidayAdjustments(ano - 1);
    if (!anteriores.length) return { error: `${ano - 1} não tem feriados criados nem ajustes para copiar.` };
    const antigo = holidays(ano - 1);
    const novo = holidays(ano);
    const items: HolidayAdjustment[] = [];
    for (const a of anteriores) {
      const doCalendario = antigo.find((h) => h.dia === a.dia);
      if (doCalendario) {
        const mesmo = novo.find((h) => h.nome === doCalendario.nome);
        if (mesmo) items.push({ ...a, dia: mesmo.dia });
        continue;
      }
      if (!a.fecha) continue;
      const dia = `${ano}${a.dia.slice(4)}`;
      if (validDay(dia)) items.push({ ...a, dia });
    }
    const copiados = await insertHolidayAdjustments(items, session.nome);
    console.info(`[feriados] ${session.apelido} copiou ${copiados} ajustes de ${ano - 1} para ${ano}`);
    refresh();
    return copiados ? { ok: true } : { error: `Nada novo para copiar: ${ano} já tem esses dias ajustados.` };
  } catch (err) {
    console.error("[feriados] erro ao copiar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível copiar. Tente novamente." };
  }
}

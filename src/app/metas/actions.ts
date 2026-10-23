"use server";

import { refresh } from "next/cache";
import { insertMissingGoals, listGoals, saveGoals } from "@/lib/metas";
import { parseMoney } from "@/lib/money-input";
import { getStoreVendors } from "@/lib/sales";
import { getSession } from "@/lib/session";

export type GoalsState = { ok?: boolean; error?: string };

const MAX = 1_000_000_000;

/** Master e admin gravam as metas de uma loja no mês: meta_loja e meta_<codvend>; campo vazio apaga. */
export async function saveGoalsAction(_prev: GoalsState, form: FormData): Promise<GoalsState> {
  const session = await getSession();
  if (session?.role !== "master" && session?.role !== "admin") return { error: "Só a diretoria e o admin definem metas." };

  const codemp = Number(form.get("loja"));
  const mesTxt = String(form.get("mes") ?? "");
  if (!Number.isSafeInteger(codemp) || codemp <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesTxt)) return { error: "Loja ou mês inválido." };
  const mes = `${mesTxt}-01`;

  try {
    // Só aceita metas individuais de vendedores ativos daquela loja
    const vendedores = await getStoreVendors(codemp);
    const entries: { codvend: number; valor: number | null }[] = [];
    for (const codvend of [0, ...vendedores.map((v) => v.codvend)]) {
      const field = form.get(codvend ? `meta_${codvend}` : "meta_loja");
      if (field === null) continue;
      const valor = parseMoney(String(field));
      if (valor !== null && (Number.isNaN(valor) || valor <= 0 || valor > MAX)) {
        const nome = codvend ? vendedores.find((v) => v.codvend === codvend)?.nome : "da loja";
        return { error: `Valor inválido na meta ${codvend ? `de ${nome}` : nome}. Use, por exemplo, 150.000,00.` };
      }
      entries.push({ codvend, valor });
    }
    await saveGoals(mes, codemp, entries, session.nome || session.apelido);
    console.info(`[metas] ${session.apelido} (${session.role}) gravou metas da loja ${codemp} em ${mesTxt}`);
  } catch (err) {
    console.error("[metas] erro ao gravar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar as metas. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

/** Mês anterior de AAAA-MM. */
function previousMonth(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * Copia as metas do mês anterior para o mês escolhido (de uma loja ou de todas). Metas individuais só de
 * vendedores que continuam ativos na loja; o que já foi preenchido no mês não é sobrescrito.
 */
export async function copyGoalsAction(_prev: GoalsState, form: FormData): Promise<GoalsState> {
  const session = await getSession();
  if (session?.role !== "master" && session?.role !== "admin") return { error: "Só a diretoria e o admin definem metas." };

  const mesTxt = String(form.get("mes") ?? "");
  const lojaRaw = Number(form.get("loja") || 0);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesTxt) || !Number.isSafeInteger(lojaRaw) || lojaRaw < 0) return { error: "Mês ou loja inválidos." };
  const loja = lojaRaw || undefined;

  try {
    const anteriores = await listGoals(`${previousMonth(mesTxt)}-01`, loja);
    if (!anteriores.length) return { error: "O mês anterior não tem metas para copiar." };
    const lojas = [...new Set(anteriores.map((g) => g.codemp))];
    const ativos = new Map(await Promise.all(lojas.map(async (c) => [c, new Set((await getStoreVendors(c)).map((v) => v.codvend))] as const)));
    const copiar = anteriores.filter((g) => g.codvend === 0 || ativos.get(g.codemp)?.has(g.codvend));
    const copiadas = await insertMissingGoals(`${mesTxt}-01`, copiar, session.nome || session.apelido);
    console.info(`[metas] ${session.apelido} copiou ${copiadas} metas de ${previousMonth(mesTxt)} para ${mesTxt}${loja ? ` (loja ${loja})` : ""}`);
    if (!copiadas) return { error: "Nada novo para copiar: este mês já tem essas metas preenchidas." };
  } catch (err) {
    console.error("[metas] erro ao copiar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível copiar as metas. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

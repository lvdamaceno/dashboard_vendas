"use server";

import { refresh } from "next/cache";
import { copyGoals, listGoalPeople, META_LOJA, META_VENDEDOR, saveGoalPeople, saveGoals, type GoalPerson } from "@/lib/metas";
import { parseMoney } from "@/lib/money-input";
import { getStores, salesPeopleByStore } from "@/lib/sales";
import { getSession } from "@/lib/session";

export type GoalsState = { ok?: boolean; error?: string };

const MAX = 1_000_000_000;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

async function requireGoalManager() {
  const session = await getSession();
  return session?.role === "master" || session?.role === "admin" ? session : null;
}

/**
 * Grava as metas do mês de todas as lojas: loja_<codemp> e vendedor_<codemp> (campo vazio apaga) e as pessoas
 * consideradas (pessoa_<codemp> = códigos marcados; cada pessoa só em uma loja).
 */
export async function saveGoalsAction(_prev: GoalsState, form: FormData): Promise<GoalsState> {
  const session = await requireGoalManager();
  if (!session) return { error: "Só a diretoria e o admin definem metas." };
  const mesTxt = String(form.get("mes") ?? "");
  if (!MES.test(mesTxt)) return { error: "Mês inválido." };

  try {
    // Só aceita as lojas que existem (TSIEMP com vendedor ativo)
    const [stores, candidatos, atuais] = await Promise.all([getStores(), salesPeopleByStore(), listGoalPeople(`${mesTxt}-01`)]);
    // Nome de cada código possível (quem vendeu recentemente ou já estava na lista)
    const nomes = new Map<number, string>([...atuais.map((p) => [p.codvend, p.nome] as const), ...candidatos.map((c) => [c.codvend, c.nome] as const)]);
    const pessoas: GoalPerson[] = [];
    const lojasComLista: number[] = [];
    const entries: { codemp: number; codvend: number; valor: number | null }[] = [];
    for (const s of stores) {
      for (const [campo, codvend, rotulo] of [
        [`loja_${s.codigo}`, META_LOJA, "da loja"],
        [`vendedor_${s.codigo}`, META_VENDEDOR, "por vendedor"],
      ] as const) {
        const field = form.get(campo);
        if (field === null) continue;
        const valor = parseMoney(String(field));
        if (valor !== null && (Number.isNaN(valor) || valor <= 0 || valor > MAX)) {
          return { error: `Valor inválido na meta ${rotulo} de ${s.nome}. Use, por exemplo, 150.000,00.` };
        }
        entries.push({ codemp: s.codigo, codvend, valor });
      }
      if (form.get(`pessoas_${s.codigo}`) === null) continue;
      lojasComLista.push(s.codigo);
      for (const raw of form.getAll(`pessoa_${s.codigo}`)) {
        const codvend = Number(raw);
        const nome = nomes.get(codvend);
        if (!Number.isSafeInteger(codvend) || !nome) continue;
        const outra = pessoas.find((p) => p.codvend === codvend);
        if (outra) return { error: `${nome} está marcado em duas lojas. Cada pessoa conta em uma loja só.` };
        pessoas.push({ codemp: s.codigo, codvend, nome });
      }
    }
    await saveGoals(`${mesTxt}-01`, entries, session.nome || session.apelido);
    await saveGoalPeople(`${mesTxt}-01`, lojasComLista, pessoas);
    console.info(`[metas] ${session.apelido} (${session.role}) gravou as metas de ${mesTxt}`);
  } catch (err) {
    console.error("[metas] erro ao gravar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível salvar as metas. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

function previousMonth(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/** Copia as metas do mês anterior (todas as lojas), sem sobrescrever o que já foi preenchido. */
export async function copyGoalsAction(_prev: GoalsState, form: FormData): Promise<GoalsState> {
  const session = await requireGoalManager();
  if (!session) return { error: "Só a diretoria e o admin definem metas." };
  const mesTxt = String(form.get("mes") ?? "");
  if (!MES.test(mesTxt)) return { error: "Mês inválido." };
  try {
    const copiadas = await copyGoals(`${previousMonth(mesTxt)}-01`, `${mesTxt}-01`, session.nome || session.apelido);
    console.info(`[metas] ${session.apelido} copiou ${copiadas} metas de ${previousMonth(mesTxt)} para ${mesTxt}`);
    if (!copiadas) return { error: "Nada para copiar: o mês anterior não tem metas ou este mês já está preenchido." };
  } catch (err) {
    console.error("[metas] erro ao copiar:", err instanceof Error ? err.message : err);
    return { error: "Não foi possível copiar as metas. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

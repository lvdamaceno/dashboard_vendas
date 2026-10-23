"use server";

import { z } from "zod";
import { deletePhoto, finishService, joinQueue, leaveQueue, nextWaiting, reorderQueue, savePhoto, startService } from "@/lib/fila";
import { sendPushLater } from "@/lib/push";
import { loadQueue, queueStore, type QueueView } from "@/lib/fila-access";
import { getSession } from "@/lib/session";

export type QueueResult = { ok: true; view: QueueView } | { ok: false; error: string };

const loja = z.number().int().positive().optional();

/**
 * Ações da fila. A loja sempre vem da sessão (vendedor e gerente); só master e admin escolhem.
 * Cada ação devolve a fila atualizada, para a tela não esperar a próxima atualização.
 */
async function act(lojaParam: number | undefined, run: (codemp: number, codvend: number, nome: string) => Promise<void>, who: "vendedor" | "gerencia") {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." } as const;
  if (who === "vendedor" && session.role !== "vendedor") return { ok: false, error: "Só vendedores entram na fila." } as const;
  if (who === "gerencia" && session.role === "vendedor") return { ok: false, error: "Só o gerente pode organizar a fila." } as const;

  const parsed = loja.safeParse(lojaParam);
  try {
    const codemp = await queueStore(session, parsed.success ? parsed.data : undefined);
    if (!codemp) return { ok: false, error: "Não encontramos a sua loja." } as const;
    const antes = await nextWaiting(codemp);
    await run(codemp, session.codvend, session.apelido);
    // Quem acabou de virar o próximo recebe "É a sua vez!" no celular (menos quem fez a ação: já está vendo a tela)
    const depois = await nextWaiting(codemp);
    if (depois && depois.codvend !== antes?.codvend && depois.codvend !== session.codvend) {
      sendPushLater(
        { codvend: depois.codvend },
        { title: "🙋 É a sua vez!", body: "Você é o próximo a atender na fila. Receba o próximo cliente.", url: "/fila", tag: "fila-vez" },
        { ttl: 600, urgent: true },
      );
    }
    return { ok: true, view: await loadQueue(session, codemp) } as const;
  } catch (err) {
    console.error("[fila] erro:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Não foi possível atualizar a fila. Tente novamente." } as const;
  }
}

export async function enterQueue(): Promise<QueueResult> {
  return act(undefined, (codemp, codvend, nome) => joinQueue(codemp, codvend, nome), "vendedor");
}

export async function serveCustomer(): Promise<QueueResult> {
  return act(undefined, (codemp, codvend) => startService(codemp, codvend), "vendedor");
}

export async function finishCustomer(): Promise<QueueResult> {
  return act(undefined, (codemp, codvend) => finishService(codemp, codvend), "vendedor");
}

export async function exitQueue(): Promise<QueueResult> {
  return act(undefined, (codemp, codvend) => leaveQueue(codemp, codvend), "vendedor");
}

const codes = z.array(z.number().int().positive()).max(200);

/** Gerente (da própria loja), master e admin: nova ordem da fila. */
export async function reorder(lojaParam: number | undefined, order: number[]): Promise<QueueResult> {
  const parsed = codes.safeParse(order);
  if (!parsed.success) return { ok: false, error: "Ordem inválida." };
  return act(lojaParam, (codemp) => reorderQueue(codemp, parsed.data), "gerencia");
}

/** Gerente, master e admin: tira alguém da fila (ex.: foi embora). */
export async function removeFromQueue(lojaParam: number | undefined, codvend: number): Promise<QueueResult> {
  if (!Number.isSafeInteger(codvend) || codvend <= 0) return { ok: false, error: "Vendedor inválido." };
  return act(lojaParam, (codemp) => leaveQueue(codemp, codvend), "gerencia");
}

// --- foto do vendedor ---

const MAX_PHOTO = 300 * 1024;

/** O vendedor troca a própria foto. Só JPEG (o navegador já reduz para 256x256); a nova substitui a anterior. */
export async function uploadPhoto(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (session?.role !== "vendedor") return { ok: false, error: "Só vendedores têm foto na fila." };
  const file = form.get("foto");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma foto." };
  if (file.size > MAX_PHOTO) return { ok: false, error: "Foto muito grande." };

  const dados = Buffer.from(await file.arrayBuffer());
  // Confere pelo conteúdo (não pelo nome nem pelo tipo informado): JPEG começa com FF D8 FF
  if (!(dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff)) return { ok: false, error: "Formato de imagem inválido." };

  try {
    await savePhoto(session.codvend, dados);
    console.info(`[fila] ${session.apelido} trocou a foto (${Math.round(dados.length / 1024)} KB)`);
  } catch (err) {
    console.error("[fila] erro ao salvar foto:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Não foi possível salvar a foto. Tente novamente." };
  }
  return { ok: true };
}

export async function removePhoto(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (session?.role !== "vendedor") return { ok: false, error: "Sem acesso." };
  try {
    await deletePhoto(session.codvend);
  } catch (err) {
    console.error("[fila] erro ao remover foto:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Não foi possível remover a foto." };
  }
  return { ok: true };
}

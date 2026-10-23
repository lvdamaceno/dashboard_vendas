import "server-only";
import { listQueue, type QueueEntry } from "./fila";
import { vendorStore } from "./sales";
import type { Session } from "./session";

export interface QueueView {
  codemp: number;
  /** Quem está vendo (se for vendedor da fila) */
  eu: number | null;
  /** Gerente da loja, master e admin reorganizam e tiram gente da fila */
  gerencia: boolean;
  fila: QueueEntry[];
}

/**
 * Qual fila a pessoa vê:
 *  - vendedor: só a da própria loja (TGFVEN.CODEMP do seu código), nunca a de outra;
 *  - gerente: a da loja dele;
 *  - master e admin: a da loja escolhida.
 * Retorna null quando não há loja (ex.: master sem loja escolhida).
 */
export async function queueStore(session: Session, lojaParam?: number) {
  if (session.role === "vendedor") return vendorStore(session.codvend, 5 * 60_000);
  if (session.role === "gerente") return session.codemp || null;
  return lojaParam ?? null;
}

export async function loadQueue(session: Session, codemp: number): Promise<QueueView> {
  return {
    codemp,
    eu: session.role === "vendedor" ? session.codvend : null,
    gerencia: session.role !== "vendedor",
    fila: await listQueue(codemp),
  };
}

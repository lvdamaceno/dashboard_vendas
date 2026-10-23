import "server-only";
import { sql } from "./db";
import { addDays, todayIso } from "./period";

// Lembretes recorrentes (painel.lembrete): no dia, viram um aviso no sino do público escolhido.
// Não há tarefa agendada: a entrega acontece na primeira abertura de tela depois que o lembrete vence.

export type Publico = "master" | "gerente" | "vendedor" | "todos";
export type Recorrencia = "mensal" | "semanal" | "diaria" | "unica";

export interface Reminder {
  id: number;
  titulo: string;
  mensagem: string;
  publico: Publico;
  recorrencia: Recorrencia;
  dia: number | null;
  data: string | null;
  ativo: boolean;
  ultimoEnvio: string | null;
  criadoEm: string;
}

const COLS = `id, titulo, mensagem, publico, recorrencia, dia, to_char(data, 'YYYY-MM-DD') AS data, ativo,
              to_char(ultimo_envio, 'YYYY-MM-DD') AS "ultimoEnvio",
              to_char(criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS "criadoEm"`;

export async function listReminders() {
  return sql<Reminder>(`SELECT ${COLS} FROM painel.lembrete ORDER BY ativo DESC, id DESC`);
}

export async function createReminder(r: Pick<Reminder, "titulo" | "mensagem" | "publico" | "recorrencia" | "dia" | "data">) {
  await sql(`INSERT INTO painel.lembrete (titulo, mensagem, publico, recorrencia, dia, data) VALUES ($1, $2, $3, $4, $5, $6::date)`, [
    r.titulo,
    r.mensagem,
    r.publico,
    r.recorrencia,
    r.dia,
    r.data,
  ]);
}

export async function setReminderActive(id: number, ativo: boolean) {
  await sql(`UPDATE painel.lembrete SET ativo = $2 WHERE id = $1`, [id, ativo]);
}

export async function deleteReminder(id: number) {
  await sql(`DELETE FROM painel.lembrete WHERE id = $1`, [id]);
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Data da ocorrência mais recente até `today` (AAAA-MM-DD), ou null se ainda não houve nenhuma. */
export function lastOccurrence(r: Pick<Reminder, "recorrencia" | "dia" | "data">, today: string): string | null {
  const [y, m, d] = today.split("-").map(Number);
  switch (r.recorrencia) {
    case "diaria":
      return today;
    case "semanal": {
      const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
      return addDays(today, -((dow - (r.dia ?? 0) + 7) % 7));
    }
    case "mensal": {
      const dia = Math.min(r.dia ?? 1, lastDayOfMonth(y, m));
      if (dia <= d) return `${today.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(r.dia ?? 1, lastDayOfMonth(py, pm))).padStart(2, "0")}`;
    }
    case "unica":
      return r.data && r.data <= today ? r.data : null;
  }
}

/** Próxima ocorrência a partir de amanhã (para mostrar na tela do admin). */
export function nextOccurrence(r: Pick<Reminder, "recorrencia" | "dia" | "data">, today: string): string | null {
  if (r.recorrencia === "unica") return r.data && r.data > today ? r.data : null;
  for (let i = 1; i <= 62; i++) {
    const dia = addDays(today, i);
    if (lastOccurrence(r, dia) === dia) return dia;
  }
  return null;
}

let lastRun = 0;

/**
 * Entrega os lembretes vencidos como avisos. Roda no máximo uma vez por minuto por servidor; o UPDATE com
 * condição garante uma entrega por ocorrência mesmo com várias instâncias. Ocorrências de antes da criação
 * do lembrete não são entregues.
 */
export async function deliverDueReminders() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  const today = todayIso();
  const ativos = (await listReminders()).filter((r) => r.ativo);
  for (const r of ativos) {
    const occ = lastOccurrence(r, today);
    if (!occ || occ < r.criadoEm || (r.ultimoEnvio && r.ultimoEnvio >= occ)) continue;
    const claimed = await sql(
      `UPDATE painel.lembrete SET ultimo_envio = $2::date WHERE id = $1 AND (ultimo_envio IS NULL OR ultimo_envio < $2::date) RETURNING id`,
      [r.id, occ],
    );
    if (!claimed.length) continue;
    await sql(
      `INSERT INTO painel.aviso (titulo, mensagem, codemp, autor_nome, autor_papel, papel) VALUES ($1, $2, NULL, 'Lembrete', 'admin', $3)`,
      [r.titulo, r.mensagem, r.publico === "todos" ? null : r.publico],
    );
    console.info(`[lembretes] "${r.titulo}" entregue para ${r.publico} (${occ})`);
  }
}

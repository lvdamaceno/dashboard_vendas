import "server-only";
import { sql } from "./db";
import { deliverDueReminders } from "./lembretes";
import { seesAllStores, userKey, type Session } from "./session";

// Dados próprios do painel no Postgres (schema "painel"): masters, avisos e sugestões.

export interface Master {
  id: number;
  cpf: string;
  nome: string;
  criadoEm: Date;
  /** Quando criou (ou trocou) a senha; null = ainda não fez o primeiro acesso */
  senhaEm: Date | null;
}

export async function findMaster(cpf: string): Promise<{ id: number; nome: string; senhaHash: string | null } | null> {
  const rows = await sql<{ id: number; nome: string; senhaHash: string | null }>(
    `SELECT id, nome, senha_hash AS "senhaHash" FROM painel.usuario_master WHERE cpf = $1`,
    [cpf],
  );
  return rows[0] ?? null;
}

export async function getMasterPasswordHash(id: number) {
  const rows = await sql<{ senhaHash: string | null }>(`SELECT senha_hash AS "senhaHash" FROM painel.usuario_master WHERE id = $1`, [id]);
  return rows[0]?.senhaHash ?? null;
}

/**
 * Grava a senha do master. onlyIfEmpty: só no primeiro acesso (se outra aba/pessoa já criou, não sobrescreve).
 * Retorna se gravou.
 */
export async function setMasterPassword(id: number, hash: string, onlyIfEmpty: boolean) {
  const rows = await sql(
    `UPDATE painel.usuario_master SET senha_hash = $2, senha_em = now() WHERE id = $1 ${onlyIfEmpty ? "AND senha_hash IS NULL" : ""} RETURNING id`,
    [id, hash],
  );
  return rows.length > 0;
}

/** Admin zera a senha: no próximo acesso o master cria outra. */
export async function resetMasterPassword(id: number) {
  await sql(`UPDATE painel.usuario_master SET senha_hash = NULL, senha_em = NULL WHERE id = $1`, [id]);
}

export async function getMaster(id: number): Promise<{ id: number; nome: string } | null> {
  const rows = await sql<{ id: number; nome: string }>(`SELECT id, nome FROM painel.usuario_master WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function masterExists(id: number) {
  const rows = await sql(`SELECT 1 FROM painel.usuario_master WHERE id = $1`, [id]);
  return rows.length > 0;
}

export async function listMasters() {
  return sql<Master>(`SELECT id, cpf, nome, criado_em AS "criadoEm", senha_em AS "senhaEm" FROM painel.usuario_master ORDER BY nome`);
}

export async function addMaster(cpf: string, nome: string) {
  await sql(`INSERT INTO painel.usuario_master (cpf, nome) VALUES ($1, $2) ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome`, [cpf, nome]);
}

export async function removeMaster(id: number) {
  await sql(`DELETE FROM painel.usuario_master WHERE id = $1`, [id]);
}

export interface Notice {
  id: number;
  titulo: string;
  mensagem: string;
  /** null = todas as lojas */
  codemp: number | null;
  autorNome: string;
  autorPapel: "admin" | "master" | "gerente";
  /** Só para este papel (null = todos) */
  papel: "master" | "gerente" | "vendedor" | null;
  criadoEm: Date;
  novo: boolean;
}

/**
 * Avisos que a pessoa vê: master e admin veem todos; vendedor e gerente, os de
 * todas as lojas e os da própria loja. "novo" = criado depois da última vez que abriu o sino.
 */
export async function listNotices(session: Session, max = 30) {
  // Lembretes que venceram viram avisos antes de listar (se falhar, os avisos aparecem mesmo assim)
  await deliverDueReminders().catch((err) => console.error("[lembretes] erro ao entregar:", err instanceof Error ? err.message : err));
  const all = seesAllStores(session);
  return sql<Notice>(
    `SELECT a.id, a.titulo, a.mensagem, a.codemp, a.autor_nome AS "autorNome", a.autor_papel AS "autorPapel", a.papel,
            a.criado_em AS "criadoEm", (v.visto_em IS NULL OR a.criado_em > v.visto_em) AS novo
       FROM painel.aviso a
       LEFT JOIN painel.aviso_visto v ON v.usuario = $1
      WHERE ($2::boolean OR a.codemp IS NULL OR a.codemp = $3)
        -- aviso para um papel (ex.: lembrete da diretoria) só aparece para ele; o admin vê todos
        AND (a.papel IS NULL OR a.papel = $5 OR $5 = 'admin')
      ORDER BY a.criado_em DESC
      LIMIT $4`,
    [userKey(session), all, session.codemp, max, session.role],
  );
}

export async function markNoticesSeen(session: Session) {
  await sql(
    `INSERT INTO painel.aviso_visto (usuario, visto_em) VALUES ($1, now())
     ON CONFLICT (usuario) DO UPDATE SET visto_em = now()`,
    [userKey(session)],
  );
}

export async function createNotice(n: { titulo: string; mensagem: string; codemp: number | null; autorNome: string; autorPapel: Notice["autorPapel"] }) {
  await sql(`INSERT INTO painel.aviso (titulo, mensagem, codemp, autor_nome, autor_papel) VALUES ($1, $2, $3, $4, $5)`, [
    n.titulo,
    n.mensagem,
    n.codemp,
    n.autorNome,
    n.autorPapel,
  ]);
}

export async function deleteNotice(id: number) {
  await sql(`DELETE FROM painel.aviso WHERE id = $1`, [id]);
}

export interface Feedback {
  id: number;
  tipo: "sugestao" | "erro";
  mensagem: string;
  autorNome: string;
  autorPapel: string;
  codemp: number | null;
  codvend: number | null;
  pagina: string | null;
  navegador: string | null;
  concluido: boolean;
  concluidoEm: Date | null;
  criadoEm: Date;
}

export async function createFeedback(f: Omit<Feedback, "id" | "concluido" | "concluidoEm" | "criadoEm">) {
  await sql(
    `INSERT INTO painel.feedback (tipo, mensagem, autor_nome, autor_papel, codemp, codvend, pagina, navegador)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [f.tipo, f.mensagem, f.autorNome, f.autorPapel, f.codemp, f.codvend, f.pagina, f.navegador],
  );
}

export async function listFeedback(filtro: "pendentes" | "concluidos" | "todos") {
  const where = filtro === "todos" ? "" : `WHERE concluido = ${filtro === "concluidos"}`;
  return sql<Feedback>(
    `SELECT id, tipo, mensagem, autor_nome AS "autorNome", autor_papel AS "autorPapel", codemp, codvend, pagina, navegador,
            concluido, concluido_em AS "concluidoEm", criado_em AS "criadoEm"
       FROM painel.feedback ${where}
      ORDER BY criado_em DESC
      LIMIT 200`,
  );
}

export async function countPendingFeedback() {
  const [row] = await sql<{ total: number }>(`SELECT count(*)::int AS total FROM painel.feedback WHERE NOT concluido`);
  return row?.total ?? 0;
}

export async function setFeedbackDone(id: number, done: boolean) {
  await sql(`UPDATE painel.feedback SET concluido = $2, concluido_em = CASE WHEN $2 THEN now() END WHERE id = $1`, [id, done]);
}

/** Clientes tirados da lista de "chamar de volta": código → dia (AAAA-MM-DD, horário de Brasília) em que saíram. */
export async function listDismissedClients() {
  const rows = await sql<{ codparc: number; dia: string }>(
    `SELECT codparc, to_char(dispensado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia FROM painel.cliente_dispensado`,
  );
  return new Map(rows.map((r) => [r.codparc, r.dia]));
}

export async function dismissClient(d: { codparc: number; autorNome: string; autorPapel: string; codemp: number | null; codvend: number | null }) {
  await sql(
    `INSERT INTO painel.cliente_dispensado (codparc, autor_nome, autor_papel, codemp, codvend) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (codparc) DO UPDATE SET autor_nome = EXCLUDED.autor_nome, autor_papel = EXCLUDED.autor_papel,
       codemp = EXCLUDED.codemp, codvend = EXCLUDED.codvend, dispensado_em = now()`,
    [d.codparc, d.autorNome, d.autorPapel, d.codemp, d.codvend],
  );
}

export interface PhoneOverride {
  codvend: number;
  telefone: string;
  autorNome: string;
  atualizadoEm: Date;
}

/** Telefones salvos pelo app (têm prioridade sobre o do Sankhya), por código de vendedor. */
export async function getPhoneOverrides(codvends?: number[]) {
  const rows = await sql<PhoneOverride>(
    `SELECT codvend, telefone, autor_nome AS "autorNome", atualizado_em AS "atualizadoEm" FROM painel.telefone
      ${codvends ? "WHERE codvend = ANY($1::int[])" : ""}`,
    codvends ? [codvends] : [],
  );
  return new Map(rows.map((r) => [r.codvend, r]));
}

export async function savePhoneOverride(codvend: number, telefone: string, autorNome: string, autorPapel: string) {
  await sql(
    `INSERT INTO painel.telefone (codvend, telefone, autor_nome, autor_papel) VALUES ($1, $2, $3, $4)
     ON CONFLICT (codvend) DO UPDATE SET telefone = EXCLUDED.telefone, autor_nome = EXCLUDED.autor_nome,
       autor_papel = EXCLUDED.autor_papel, atualizado_em = now()`,
    [codvend, telefone, autorNome, autorPapel],
  );
}

export async function clearPhoneOverride(codvend: number) {
  await sql(`DELETE FROM painel.telefone WHERE codvend = $1`, [codvend]);
}

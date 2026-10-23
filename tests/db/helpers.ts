import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach } from "vitest";

/** Testes de banco só rodam com TEST_DATABASE_URL (um Postgres descartável: o schema "painel" é recriado). */
export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

const TABELAS = [
  "fila", "foto", "atendimento", "aviso", "aviso_visto", "feedback", "meta", "meta_pessoa", "telefone",
  "cliente_dispensado", "feriado", "lembrete", "evento", "push_inscricao", "config", "usuario_master",
];

let client: Client;

/** Cria o schema (db/schema.sql) uma vez e limpa as tabelas antes de cada teste. */
export function useTestDb() {
  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    await client.query(readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8"));
  });
  beforeEach(async () => {
    await client.query(`TRUNCATE ${TABELAS.map((t) => `painel.${t}`).join(", ")} RESTART IDENTITY`);
  });
  afterAll(async () => {
    await client.end();
  });
  return { query: (text: string, params?: unknown[]) => client.query(text, params) };
}

/** Dia da fila no Postgres (vira às 7h de Brasília). */
export const DIA_FILA = `(now() AT TIME ZONE 'America/Sao_Paulo' - interval '7 hours')::date`;

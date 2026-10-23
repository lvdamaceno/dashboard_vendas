import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// Cria o schema "painel" no Postgres de teste antes dos testes de ponta a ponta.
export default async function globalSetup() {
  if (!process.env.TEST_DATABASE_URL) throw new Error("Defina TEST_DATABASE_URL (Postgres descartável) para os testes de ponta a ponta.");
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  await db.query(readFileSync(path.resolve(__dirname, "../../db/schema.sql"), "utf8"));
  await db.end();
}

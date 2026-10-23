import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Postgres compartilhado com a loja (loja-casacontente-db), schema "painel" (db/schema.sql).
// Guarda só o que o Sankhya não tem: masters, avisos e sugestões. Projeto pequeno: poucas conexões.
let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    // A URL interna do Render (host sem domínio) dispensa TLS; a externa exige
    const external = new URL(url).hostname.includes(".");
    pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000, ssl: external ? { rejectUnauthorized: false } : undefined });
    pool.on("error", (err) => console.error("[db] conexão ociosa falhou:", err.message));
  }
  return pool;
}

/** Consulta parametrizada ($1, $2…); valores nunca são concatenados no SQL. */
export async function sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const { rows } = await getPool().query<T>(text, params);
  return rows;
}

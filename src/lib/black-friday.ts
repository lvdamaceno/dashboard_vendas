import "server-only";
import { sql } from "./db";

// Liga e desliga a consulta de descontos da Black Friday (aba "Black Friday" do admin).
// Sem registro em painel.config, vale ligada. Os produtos ficam em src/lib/black-friday-produtos.ts.
const CHAVE = "black_friday";

/** Lança erro se o banco não responder: quem chama decide o que fazer (a consulta some em vez de aparecer indevidamente). */
export async function blackFridayAtiva() {
  const rows = await sql<{ valor: string }>(`SELECT valor FROM painel.config WHERE chave = $1`, [CHAVE]);
  return rows[0]?.valor !== "0";
}

export async function setBlackFridayAtiva(ativa: boolean) {
  await sql(`INSERT INTO painel.config (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`, [CHAVE, ativa ? "1" : "0"]);
}

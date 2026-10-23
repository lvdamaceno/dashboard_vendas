import "server-only";
import { listMasters } from "./painel";
import { getPeople, type Person } from "./sales";

/**
 * Todos de quem o admin pode ver o painel: masters (banco do painel) e vendedores/gerentes
 * (Sankhya). Se uma das fontes falhar, mostra a outra.
 */
export async function listPeopleForAdmin(): Promise<Person[]> {
  const [masters, sankhya] = await Promise.all([
    listMasters().catch((err) => {
      console.error("[admin] masters:", err instanceof Error ? err.message : err);
      return [];
    }),
    getPeople().catch((err) => {
      console.error("[admin] vendedores e gerentes:", err instanceof Error ? err.message : err);
      return [];
    }),
  ]);
  return [...masters.map((m): Person => ({ codigo: m.id, nome: m.nome, role: "master", codemp: 0 })), ...sankhya];
}

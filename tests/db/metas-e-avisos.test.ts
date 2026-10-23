import { describe, expect, it } from "vitest";
import { deliverDueReminders } from "@/lib/lembretes";
import { copyGoals, listGoalPeople, listGoals, META_LOJA, META_VENDEDOR, saveGoalPeople, saveGoals } from "@/lib/metas";
import { createNotice, listNotices } from "@/lib/painel";
import type { Session } from "@/lib/session";
import { hasDb, useTestDb } from "./helpers";

const sess = (over: Partial<Session>): Session => ({ codfunc: 1, nome: "X", codvend: 901, apelido: "X", role: "vendedor", codemp: 1, ...over });

describe.skipIf(!hasDb)("metas", () => {
  const db = useTestDb();

  it("grava meta da loja e por vendedor; vazio apaga", async () => {
    await saveGoals("2026-10-01", [
      { codemp: 1, codvend: META_LOJA, valor: 300000 },
      { codemp: 1, codvend: META_VENDEDOR, valor: 100000 },
    ], "teste");
    expect((await listGoals("2026-10-01")).get(1)).toEqual({ loja: 300000, vendedor: 100000 });
    await saveGoals("2026-10-01", [{ codemp: 1, codvend: META_VENDEDOR, valor: null }], "teste");
    expect((await listGoals("2026-10-01")).get(1)).toEqual({ loja: 300000, vendedor: null });
  });

  it("cada pessoa conta em uma loja só", async () => {
    await saveGoalPeople("2026-10-01", [1], [{ codemp: 1, codvend: 59, nome: "RINALDO" }]);
    await saveGoalPeople("2026-10-01", [5], [{ codemp: 5, codvend: 59, nome: "RINALDO" }]);
    expect(await listGoalPeople("2026-10-01")).toEqual([{ codemp: 5, codvend: 59, nome: "RINALDO" }]);
  });

  it("copiar do mês anterior não sobrescreve o que já foi preenchido", async () => {
    await saveGoals("2026-10-01", [{ codemp: 1, codvend: META_LOJA, valor: 300000 }, { codemp: 4, codvend: META_LOJA, valor: 550000 }], "t");
    await saveGoalPeople("2026-10-01", [1], [{ codemp: 1, codvend: 21, nome: "VALDIRENE" }]);
    await saveGoals("2026-11-01", [{ codemp: 1, codvend: META_LOJA, valor: 320000 }], "t");
    expect(await copyGoals("2026-10-01", "2026-11-01", "t")).toBe(1);
    const nov = await listGoals("2026-11-01");
    expect(nov.get(1)?.loja).toBe(320000);
    expect(nov.get(4)?.loja).toBe(550000);
    expect(await listGoalPeople("2026-11-01")).toHaveLength(1);
    expect(db).toBeTruthy();
  });
});

describe.skipIf(!hasDb)("avisos e lembretes", () => {
  const db = useTestDb();

  it("vendedor vê os de todas as lojas e os da loja dele; master vê todos", async () => {
    await createNotice({ titulo: "Geral", mensagem: "x", codemp: null, autorNome: "Admin", autorPapel: "admin" });
    await createNotice({ titulo: "Loja 1", mensagem: "x", codemp: 1, autorNome: "G", autorPapel: "gerente" });
    await createNotice({ titulo: "Loja 4", mensagem: "x", codemp: 4, autorNome: "G", autorPapel: "gerente" });
    const titulos = async (s: Session) => (await listNotices(s)).map((n) => n.titulo).sort();
    expect(await titulos(sess({ role: "vendedor", codemp: 1 }))).toEqual(["Geral", "Loja 1"]);
    expect(await titulos(sess({ role: "master", codemp: 0, masterId: 1 }))).toEqual(["Geral", "Loja 1", "Loja 4"]);
  });

  it("lembrete vence uma vez, só para o público dele", async () => {
    await db.query(
      `INSERT INTO painel.lembrete (titulo, mensagem, publico, recorrencia, criado_em) VALUES ('Metas', 'Preencher', 'master', 'diaria', now() - interval '2 days')`,
    );
    await deliverDueReminders({ force: true });
    await deliverDueReminders({ force: true }); // a mesma ocorrência não é entregue duas vezes
    const { rows } = await db.query(`SELECT titulo, papel FROM painel.aviso`);
    expect(rows).toEqual([{ titulo: "Metas", papel: "master" }]);
    expect((await listNotices(sess({ role: "vendedor" }))).map((n) => n.titulo)).toEqual([]);
    expect((await listNotices(sess({ role: "master", codemp: 0, masterId: 1 }))).map((n) => n.titulo)).toEqual(["Metas"]);
  });
});

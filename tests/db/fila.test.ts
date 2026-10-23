import { describe, expect, it } from "vitest";
import { finishService, joinQueue, leaveQueue, listQueue, nextWaiting, reorderQueue, startService } from "@/lib/fila";
import { DIA_FILA, hasDb, useTestDb } from "./helpers";

describe.skipIf(!hasDb)("fila de atendimento", () => {
  const db = useTestDb();
  const ordem = async (loja = 1) => (await listQueue(loja)).map((f) => `${f.nome}${f.atendendo ? "*" : ""}`);

  it("entra no fim, sem duplicar", async () => {
    await joinQueue(1, 902, "BRUNO");
    await joinQueue(1, 901, "ANA");
    await joinQueue(1, 902, "BRUNO");
    expect(await ordem()).toEqual(["BRUNO", "ANA"]);
    expect((await nextWaiting(1))?.codvend).toBe(902);
  });

  it("atender vai para o fim e o próximo passa a ser o seguinte", async () => {
    await joinQueue(1, 902, "BRUNO");
    await joinQueue(1, 901, "ANA");
    await startService(1, 902, "BRUNO");
    expect(await ordem()).toEqual(["ANA", "BRUNO*"]);
    expect((await nextWaiting(1))?.codvend).toBe(901);
  });

  it("terminar registra o resultado e o motivo (só quando não vendeu)", async () => {
    await joinQueue(1, 901, "ANA");
    await startService(1, 901, "ANA");
    await finishService(1, 901, "nao_vendeu", "preco");
    await startService(1, 901, "ANA");
    await finishService(1, 901, "vendeu", "preco");
    const { rows } = await db.query(`SELECT resultado, motivo, fim IS NOT NULL AS fechado FROM painel.atendimento ORDER BY id`);
    expect(rows).toEqual([
      { resultado: "nao_vendeu", motivo: "preco", fechado: true },
      { resultado: "vendeu", motivo: null, fechado: true },
    ]);
    expect(await ordem()).toEqual(["ANA"]);
  });

  it("sair da fila no meio de um atendimento fecha o atendimento sem resultado", async () => {
    await joinQueue(1, 901, "ANA");
    await startService(1, 901, "ANA");
    await leaveQueue(1, 901);
    const { rows } = await db.query(`SELECT resultado, fim IS NOT NULL AS fechado FROM painel.atendimento`);
    expect(rows).toEqual([{ resultado: null, fechado: true }]);
    expect(await ordem()).toEqual([]);
  });

  it("gerente reorganiza", async () => {
    for (const [c, n] of [[902, "BRUNO"], [903, "CARLA"], [901, "ANA"]] as const) await joinQueue(1, c, n);
    await reorderQueue(1, [901, 902, 903]);
    expect(await ordem()).toEqual(["ANA", "BRUNO", "CARLA"]);
  });

  it("cada loja tem a sua fila, e a de ontem não aparece (zera às 7h)", async () => {
    await joinQueue(1, 901, "ANA");
    await joinQueue(4, 340, "IVAN");
    await db.query(`INSERT INTO painel.fila (dia, codemp, codvend, nome, posicao) VALUES (${DIA_FILA} - 1, 1, 902, 'BRUNO', 1)`);
    expect(await ordem(1)).toEqual(["ANA"]);
    expect(await ordem(4)).toEqual(["IVAN"]);
  });
});

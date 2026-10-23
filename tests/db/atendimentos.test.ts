import { describe, expect, it } from "vitest";
import { conversao, serviceStats } from "@/lib/atendimentos";
import type { Session } from "@/lib/session";
import { DIA_FILA, hasDb, useTestDb } from "./helpers";

const sess = (over: Partial<Session>): Session => ({ codfunc: 1, nome: "X", codvend: 0, apelido: "X", role: "vendedor", codemp: 1, ...over });

describe.skipIf(!hasDb)("atendimentos e conversão", () => {
  const db = useTestDb();

  async function seed() {
    const rows: [number, number, string, string | null, string | null][] = [
      [1, 901, "ANA", "vendeu", null],
      [1, 901, "ANA", "nao_vendeu", "preco"],
      [1, 901, "ANA", "so_olhando", null],
      [1, 902, "BRUNO", "vendeu", null],
      [1, 902, "BRUNO", null, null],
      [4, 340, "IVAN", "nao_vendeu", "sem_produto"],
    ];
    for (const [e, v, n, r, m] of rows) {
      await db.query(
        `INSERT INTO painel.atendimento (dia, codemp, codvend, nome, inicio, fim, resultado, motivo)
         VALUES (${DIA_FILA}, $1, $2, $3, now() - interval '10 minutes', now(), $4, $5)`,
        [e, v, n, r, m],
      );
    }
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const periodo = ["2000-01-01", "2100-01-01"] as const;

  it("vendedor vê só os dele", async () => {
    await seed();
    const s = await serviceStats(sess({ role: "vendedor", codvend: 901 }), ...periodo);
    expect(s.linhas.map((l) => l.codvend)).toEqual([901]);
    expect(conversao(s.linhas[0])).toBeCloseTo(1 / 3, 6);
    expect(s.linhas[0].tempoMedio).toBeCloseTo(10, 0);
  });

  it("gerente vê a loja dele (e o filtro de vendedor só restringe)", async () => {
    await seed();
    const loja = await serviceStats(sess({ role: "gerente", codemp: 1 }), ...periodo);
    expect(loja.linhas.map((l) => l.codvend).sort()).toEqual([901, 902]);
    expect(loja.linhas.find((l) => l.codvend === 902)?.semRegistro).toBe(1);
    expect(loja.motivos).toEqual([{ motivo: "preco", total: 1 }]);
    const so = await serviceStats(sess({ role: "gerente", codemp: 1 }), ...periodo, 902);
    expect(so.linhas.map((l) => l.codvend)).toEqual([902]);
  });

  it("diretoria vê todas as lojas ou a escolhida", async () => {
    await seed();
    expect((await serviceStats(sess({ role: "master", codemp: 0 }), ...periodo)).linhas).toHaveLength(3);
    expect((await serviceStats(sess({ role: "master", codemp: 4 }), ...periodo)).linhas.map((l) => l.nome)).toEqual(["IVAN"]);
  });

  it("respeita o período", async () => {
    await seed();
    expect((await serviceStats(sess({ role: "master", codemp: 0 }), "2000-01-01", "2000-01-31")).linhas).toEqual([]);
    expect(hoje).toBeTruthy();
  });
});

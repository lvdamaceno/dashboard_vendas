import { afterEach, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/sankhya/client";

const CONCORRENCIA = "O serviço foi cancelado por situação de concorrência. Essa mesma sessão HTTP fez a requisição duas vezes simultaneamente.";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

/** Sankhya falso: autentica, conta consultas simultâneas e recusa as primeiras `falhas` por concorrência. */
function fakeSankhya({ falhas = 0 } = {}) {
  const stats = { emAndamento: 0, pico: 0, consultas: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      if (url.pathname === "/authenticate") return json({ access_token: "t", expires_in: 3600 });
      stats.consultas++;
      stats.emAndamento++;
      stats.pico = Math.max(stats.pico, stats.emAndamento);
      await new Promise((r) => setTimeout(r, 20));
      stats.emAndamento--;
      if (stats.consultas <= falhas) return json({ status: "4", statusMessage: CONCORRENCIA });
      return json({ status: "1", responseBody: { fieldsMetadata: [{ name: "n" }], rows: [[1]] } });
    }),
  );
  return stats;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Sankhya: requisições simultâneas", () => {
  it("manda no máximo 3 consultas ao mesmo tempo", async () => {
    const stats = fakeSankhya();
    const resultados = await Promise.all(Array.from({ length: 10 }, (_, i) => query(`select ${i} from dual`, { ttlMs: 0 })));
    expect(resultados).toHaveLength(10);
    expect(stats.consultas).toBe(10);
    expect(stats.pico).toBeLessThanOrEqual(3);
  });

  it("repete a consulta cancelada por concorrência", async () => {
    const stats = fakeSankhya({ falhas: 1 });
    expect(await query("select 1 from dual", { ttlMs: 0 })).toEqual([{ N: 1 }]);
    expect(stats.consultas).toBe(2);
  });

  it("desiste depois de 2 repetições", async () => {
    const stats = fakeSankhya({ falhas: 10 });
    await expect(query("select 2 from dual", { ttlMs: 0 })).rejects.toMatchObject({ code: "CONCURRENCY" });
    expect(stats.consultas).toBe(3);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

describe("Sankhya pela conexão central", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SANKHYA_PROXY_URL", "http://central.teste:10000");
    vi.stubEnv("SANKHYA_PROXY_CHAVE", "chave-teste");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const carregar = async () => (await import("@/lib/sankhya/client")).query;

  it("consulta pela central, com a chave, sem fazer login no Sankhya", async () => {
    const fetchFalso = vi.fn(async (_url: URL, _init?: RequestInit) => json({ d: { status: "1", responseBody: { fieldsMetadata: [{ name: "n" }], rows: [[1]] } } }));
    vi.stubGlobal("fetch", fetchFalso);
    const query = await carregar();
    expect(await query("select 1", { ttlMs: 0 })).toEqual([{ N: 1 }]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(String(url)).toBe("http://central.teste:10000/servico");
    expect((init!.headers as Record<string, string>)["x-proxy-chave"]).toBe("chave-teste");
    expect(JSON.parse(init!.body as string)).toEqual({ nome: "DbExplorerSP.executeQuery", corpo: { sql: "select 1" } });
  });

  it("repassa a recusa do Sankhya como antes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ d: { status: "0", statusMessage: "SQL inválido" } })));
    await expect((await carregar())("select 2", { ttlMs: 0 })).rejects.toMatchObject({ code: "REJECTED", message: "SQL inválido" });
  });

  it("mostra o erro da central (fila ou pausa)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ erro: "O Sankhya não está respondendo. Nova tentativa em instantes." }, 503)));
    await expect((await carregar())("select 3", { ttlMs: 0 })).rejects.toMatchObject({ code: "SERVICE", message: expect.stringContaining("não está respondendo") });
  });

  it("sem conexão com a central vira erro de rede", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect((await carregar())("select 4", { ttlMs: 0 })).rejects.toMatchObject({ code: "NETWORK" });
  });
});

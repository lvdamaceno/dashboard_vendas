import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";

const sankhya = vi.hoisted(() => ({ query: vi.fn() }));
const db = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/sankhya/client", () => sankhya);
vi.mock("@/lib/db", () => db);

const { forgetActive, stillActive } = await import("@/lib/session-check");

const vendedor: Session = { codfunc: 7, nome: "Ana", codvend: 901, apelido: "ANA", role: "vendedor", codemp: 1 };
const gerente: Session = { ...vendedor, codvend: 902, role: "gerente" };
const master: Session = { codfunc: 0, nome: "Diretor", codvend: 0, apelido: "Diretor", role: "master", codemp: 0, masterId: 3 };
const admin: Session = { codfunc: 0, nome: "Admin", codvend: 0, apelido: "Admin", role: "admin", codemp: 0 };

beforeEach(() => {
  vi.useRealTimers();
  sankhya.query.mockReset();
  db.sql.mockReset();
  (globalThis as { __painelSessaoAtiva?: Map<string, unknown> }).__painelSessaoAtiva?.clear();
});

describe("revalidação da sessão", () => {
  it("vendedor ativo continua; inativado no Sankhya sai", async () => {
    sankhya.query.mockResolvedValueOnce([{ OK: 1 }]);
    expect(await stillActive(vendedor)).toBe(true);
    const sql = sankhya.query.mock.calls[0][0] as string;
    expect(sql).toContain("VEN.CODVEND = 901");
    expect(sql).toContain("FUN.CODFUNC = 7");
    expect(sql).toContain("FUN.DTDEM IS NULL");
    expect(sql).not.toContain("TIPVEND");

    forgetActive("f:1:7:901");
    sankhya.query.mockResolvedValueOnce([]);
    expect(await stillActive(vendedor)).toBe(false);
  });

  it("gerente precisa continuar como gerente ou supervisor", async () => {
    sankhya.query.mockResolvedValueOnce([{ OK: 1 }]);
    expect(await stillActive(gerente)).toBe(true);
    expect(sankhya.query.mock.calls[0][0]).toContain("VEN.TIPVEND IN ('S', 'G')");
  });

  it("master excluído pelo admin sai; admin não é consultado", async () => {
    db.sql.mockResolvedValueOnce([]);
    expect(await stillActive(master)).toBe(false);
    expect(db.sql).toHaveBeenCalledWith(expect.stringContaining("usuario_master"), [3]);
    expect(await stillActive(admin)).toBe(true);
    expect(sankhya.query).not.toHaveBeenCalled();
  });

  it("guarda o resultado por 5 minutos", async () => {
    vi.useFakeTimers();
    sankhya.query.mockResolvedValue([{ OK: 1 }]);
    await stillActive(vendedor);
    await stillActive(vendedor);
    expect(sankhya.query).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await stillActive(vendedor);
    expect(sankhya.query).toHaveBeenCalledTimes(2);
  });

  it("Sankhya fora do ar não derruba ninguém e tenta de novo em 1 minuto", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sankhya.query.mockRejectedValueOnce(new Error("timeout"));
    expect(await stillActive(vendedor)).toBe(true);
    sankhya.query.mockResolvedValueOnce([]);
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(await stillActive(vendedor)).toBe(false);
  });
});

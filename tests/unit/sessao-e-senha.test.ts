import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { decryptSession, encryptSession, isManagerial, seesAllStores, userKey, viewSession, type Session } from "@/lib/session";

const vendedor: Session = { codfunc: 1, nome: "Ana", codvend: 901, apelido: "ANA", role: "vendedor", codemp: 1 };
const admin: Session = { codfunc: 0, nome: "Admin", codvend: 0, apelido: "Admin", role: "admin", codemp: 0 };

describe("sessão", () => {
  it("criptografa e lê de volta; cookie alterado é recusado", async () => {
    const token = await encryptSession(vendedor);
    expect(await decryptSession(token)).toMatchObject(vendedor);
    expect(await decryptSession(`${token.slice(0, -2)}xx`)).toBeNull();
    expect(await decryptSession(undefined)).toBeNull();
  });

  it("papéis", () => {
    expect(isManagerial(vendedor)).toBe(false);
    expect(isManagerial({ ...vendedor, role: "gerente" })).toBe(true);
    expect(seesAllStores({ ...vendedor, role: "master" })).toBe(true);
    expect(seesAllStores({ ...vendedor, role: "gerente" })).toBe(false);
  });

  it("admin vendo como alguém usa a sessão dessa pessoa", () => {
    const como = { ...vendedor, role: "gerente" as const };
    expect(viewSession({ ...admin, como })).toEqual(como);
    expect(viewSession(admin)).toEqual(admin);
    expect(viewSession(vendedor)).toEqual(vendedor);
  });

  it("chave do usuário para avisos e notificações", () => {
    expect(userKey(vendedor)).toBe("f:1:1:901");
    expect(userKey(admin)).toBe("admin");
    expect(userKey({ ...admin, role: "master", masterId: 7 })).toBe("m:7");
  });
});

describe("senha da diretoria", () => {
  it("hash scrypt confere só com a senha certa", async () => {
    const h = await hashPassword("minhasenha1");
    expect(h).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword("minhasenha1", h)).toBe(true);
    expect(await verifyPassword("minhasenha2", h)).toBe(false);
    expect(await hashPassword("minhasenha1")).not.toBe(h); // sal diferente a cada vez
    expect(await verifyPassword("x", "formato-invalido")).toBe(false);
  });
});

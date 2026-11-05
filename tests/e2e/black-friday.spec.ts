import { expect, test } from "@playwright/test";
import { ANA, db, loginAs } from "./helpers";

test.describe("consulta da Black Friday", () => {
  test.beforeEach(async () => {
    await db(`DELETE FROM painel.config WHERE chave = 'black_friday'`);
  });
  test.afterAll(async () => {
    await db(`DELETE FROM painel.config WHERE chave = 'black_friday'`);
  });

  test("vendedor consulta; admin desativa e o campo some", async ({ page, context }) => {
    await loginAs(context, ANA);
    await page.goto("/dashboard");
    const campo = page.getByLabel("Digite o código ou a descrição do produto");

    await campo.fill("436423");
    const item = page.getByRole("listitem").filter({ hasText: "Cód. 436423" });
    await expect(item).toContainText("TIGELA OXFORD");
    await expect(item).toContainText("50%");

    await campo.fill("empilhaveis tigela 400ml branco");
    await expect(page.getByRole("listitem").filter({ hasText: "Cód. 436423" })).toBeVisible();

    await campo.fill("produto que nao existe");
    await expect(page.getByText("Nenhum produto com esse código")).toBeVisible();

    // Em outra sessão, o admin desativa
    const vendedor = await context.cookies();
    await context.clearCookies();
    await page.goto("/admin");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("senha-admin-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
    await page.goto("/admin?aba=blackfriday");
    await expect(page.getByText("Consulta ativada")).toBeVisible();
    await page.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText("Consulta desativada")).toBeVisible();

    await context.clearCookies();
    await context.addCookies(vendedor);
    expect((await page.request.get("/api/black-friday?q=436423")).status()).toBe(403);
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Fila" }).or(page.getByRole("link", { name: "Fila" })).first()).toBeVisible();
    await expect(page.getByLabel("Digite o código ou a descrição do produto")).toHaveCount(0);
  });
});

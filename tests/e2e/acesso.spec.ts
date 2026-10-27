import { expect, test } from "@playwright/test";
import { ANA, db, loginAs } from "./helpers";

test.describe("login da diretoria com senha", () => {
  test.beforeEach(async () => {
    await db(`TRUNCATE painel.usuario_master RESTART IDENTITY`);
    await db(`INSERT INTO painel.usuario_master (cpf, nome) VALUES ('52998224725', 'Diretora Teste')`);
  });

  test("cria a senha no primeiro acesso e depois entra com ela", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("CPF").fill("529.982.247-25");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("primeiro acesso")).toBeVisible();

    await page.getByLabel("Crie a sua senha").fill("minhasenha1");
    await page.getByLabel("Repita a senha").fill("outrasenha");
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page.getByText("As duas senhas não são iguais.")).toBeVisible();

    await page.getByLabel("Crie a sua senha").fill("minhasenha1");
    await page.getByLabel("Repita a senha").fill("minhasenha1");
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Diretoria · Todas as lojas")).toBeVisible();

    // Sai e entra de novo: agora pede a senha
    await context.clearCookies();
    await page.goto("/login");
    await page.getByLabel("CPF").fill("52998224725");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByLabel("Senha").fill("errada123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Senha incorreta.")).toBeVisible();
    await page.getByLabel("Senha").fill("minhasenha1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("permissões", () => {
  test("sem sessão, o painel leva ao login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("vendedor não entra no admin nem nas metas", async ({ page, context }) => {
    await loginAs(context, ANA);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin do painel" })).toBeVisible();
    await page.goto("/metas");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("admin entra com usuário e senha", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Usuário").fill("admin");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Usuário ou senha incorretos.")).toBeVisible();
    await page.getByLabel("Senha").fill("senha-admin-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  });
});

test("vendedor que saiu do Sankhya perde o acesso no próximo clique", async ({ page, context }) => {
  // 999 não está entre os vendedores ativos do Sankhya simulado
  await loginAs(context, { ...ANA, codvend: 999 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?fora=acesso/);
  await expect(page.getByText("Seu acesso ao painel foi encerrado.")).toBeVisible();
});

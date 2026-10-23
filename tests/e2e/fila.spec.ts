import { expect, test } from "@playwright/test";
import { ANA, db, DIA_FILA, loginAs, MARCOS } from "./helpers";

test.beforeEach(async () => {
  await db(`TRUNCATE painel.fila, painel.atendimento, painel.foto`);
  await db(`INSERT INTO painel.fila (dia, codemp, codvend, nome, posicao) VALUES (${DIA_FILA}, 1, 902, 'BRUNO', 1)`);
});

test("vendedora entra na fila, atende, registra o resultado e o gerente vê a conversão", async ({ browser }) => {
  const ana = await browser.newContext();
  await loginAs(ana, ANA);
  const page = await ana.newPage();
  await page.goto("/fila");

  await page.getByRole("button", { name: "Entrar na fila" }).click();
  await expect(page.getByText("Você é o 2º da fila")).toBeVisible();

  // Bruno atende e vai para o fim: a vez é da Ana (a tela atualiza sozinha)
  await db(`UPDATE painel.fila SET atendendo = true, posicao = 10 WHERE codvend = 902`);
  await expect(page.getByText("É a sua vez!")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Atender cliente" }).click();
  await expect(page.getByText("Você está atendendo")).toBeVisible();

  await page.getByRole("button", { name: "Terminei o atendimento" }).click();
  await page.getByRole("button", { name: /Não vendeu/ }).click();
  await page.getByRole("button", { name: "Preço" }).click();
  await expect(page.getByText(/Você é o \dº da fila|É a sua vez!/)).toBeVisible();

  const [registro] = await db<{ resultado: string; motivo: string }>(`SELECT resultado, motivo FROM painel.atendimento WHERE codvend = 901`);
  expect(registro).toEqual({ resultado: "nao_vendeu", motivo: "preco" });

  // O gerente vê o atendimento no painel (período: hoje)
  const gerente = await browser.newContext();
  await loginAs(gerente, MARCOS);
  const g = await gerente.newPage();
  await g.goto("/dashboard?periodo=hoje");
  const secao = g.locator("section", { has: g.getByRole("heading", { name: "Atendimentos da fila" }) });
  await expect(secao).toBeVisible();
  await expect(secao.getByText("Preço")).toBeVisible();
  await expect(secao.getByRole("cell", { name: "ANA PAULA" })).toBeVisible();
});

test("sem atendimentos no período, o quadro aparece vazio explicando como registrar", async ({ browser }) => {
  for (const [sessao, texto] of [
    [MARCOS, "Ainda não há atendimentos registrados pela fila"],
    [ANA, "Você ainda não registrou atendimentos"],
  ] as const) {
    const ctx = await browser.newContext();
    await loginAs(ctx, sessao);
    const page = await ctx.newPage();
    await page.goto("/dashboard?periodo=hoje");
    const secao = page.locator("section", { has: page.getByRole("heading", { name: "Atendimentos da fila" }) });
    await expect(secao.getByText(texto)).toBeVisible();
    await expect(secao.getByRole("link", { name: "Abrir a fila" })).toHaveAttribute("href", "/fila");
    await ctx.close();
  }
});

test("gerente só vê a fila da própria loja, sem seletor", async ({ browser }) => {
  await db(`INSERT INTO painel.fila (dia, codemp, codvend, nome, posicao) VALUES (${DIA_FILA}, 4, 340, 'IVAN', 1)`);
  const ctx = await browser.newContext();
  await loginAs(ctx, MARCOS);
  const page = await ctx.newPage();
  await page.goto("/fila?loja=4");
  await expect(page.getByText("BRUNO")).toBeVisible();
  await expect(page.getByText("IVAN")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Loja" })).toHaveCount(0);
});

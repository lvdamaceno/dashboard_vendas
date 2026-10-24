import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ANA, db, loginAs } from "./helpers";

// As regras ficam em cache no servidor por 30 s; mudando pelo admin, valem na hora (o admin limpa o cache).
const LOJA = { latitude: -1.4558, longitude: -48.4902 };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function asAdmin(page: Page, context: BrowserContext) {
  await context.clearCookies();
  await page.goto("/admin");
  await page.getByLabel("Usuário").fill("admin");
  await page.getByLabel("Senha").fill("senha-admin-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  await page.goto("/admin?aba=acesso");
  return page.locator("form", { has: page.getByRole("heading", { name: "Vendedores" }) });
}

async function save(form: ReturnType<Page["locator"]>) {
  await form.getByRole("button", { name: "Salvar" }).click();
  await expect(form.getByText("Salvo.")).toBeVisible();
}

test.describe("horário e local de acesso", () => {
  test.beforeAll(async () => {
    await db(`TRUNCATE painel.acesso_regra, painel.acesso_local RESTART IDENTITY`);
  });

  // Volta tudo ao normal pelo admin (para não deixar regra no cache do servidor)
  test.afterEach(async ({ page, context }) => {
    const form = await asAdmin(page, context);
    await form.getByLabel("Limitar o horário de acesso").uncheck();
    await form.getByLabel("Só abrir nos locais cadastrados").uncheck();
    await save(form);
  });

  test("fora do horário, o vendedor é desconectado", async ({ page, context }) => {
    const form = await asAdmin(page, context);
    await form.getByLabel("Limitar o horário de acesso").check();
    // Uma janela de um minuto que não é agora
    const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    const inicio = hora === 0 ? "12:00" : "00:00";
    for (const dia of DIAS) {
      await form.getByRole("checkbox", { name: dia, exact: true }).check();
      await form.getByLabel(`Início ${dia}`).fill(inicio);
      await form.getByLabel(`Fim ${dia}`).fill(inicio.replace(/0$/, "1"));
    }
    await save(form);

    await context.clearCookies();
    await loginAs(context, ANA);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?fora=horario/);
    await expect(page.getByText("O horário de acesso ao painel terminou")).toBeVisible();
  });

  test("com a trava de local, só abre perto de um local cadastrado", async ({ page, context }) => {
    const form = await asAdmin(page, context);
    await page.getByPlaceholder("Nome (ex.: Loja Pedreira, Escritório)").fill("Loja Teste");
    await page.getByLabel("Coordenadas").fill(`${LOJA.latitude}, ${LOJA.longitude}`);
    await expect(page.getByText(`Ponto lido: latitude ${LOJA.latitude}, longitude ${LOJA.longitude}`)).toBeVisible();
    await page.getByRole("button", { name: "Adicionar local" }).click();
    await expect(page.getByText("Local salvo.")).toBeVisible();
    // Corrige o raio pela lista, sem apagar e criar de novo
    await page.getByRole("button", { name: "Corrigir" }).click();
    await page.getByLabel("Raio aceito").last().selectOption("200");
    await page.getByRole("button", { name: "Salvar correção" }).click();
    await expect(page.getByText("raio de 200 m")).toBeVisible();
    await form.getByLabel("Só abrir nos locais cadastrados").check();
    await save(form);

    await context.clearCookies();
    await loginAs(context, ANA);
    await context.grantPermissions(["geolocation"], { origin: "http://localhost:3123" });
    // ~1,1 km ao norte da loja
    await context.setGeolocation({ ...LOJA, latitude: LOJA.latitude + 0.01, accuracy: 20 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/acesso\?volta=%2Fdashboard/);
    await expect(page.getByText("O painel só abre nas lojas e locais autorizados. Você está a 1,1 km de Loja Teste.")).toBeVisible();

    await context.setGeolocation({ ...LOJA, accuracy: 20 });
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page).toHaveURL(/3123\/dashboard$/);
    await expect(page.getByText("Vendedor · 901")).toBeVisible();
  });
});

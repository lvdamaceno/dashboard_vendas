import "server-only";
import { z } from "zod";

const list = (re: RegExp) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .refine((items) => items.every((i) => re.test(i)), "valor inválido na lista");

// Variável vazia no .env conta como não definida
const optional = <T extends z.ZodTypeAny>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

const schema = z.object({
  SANKHYA_API_URL: z.string().url().default("https://api.sankhya.com.br"),
  // Conexão central (sankhya-central): com ela, as credenciais do Sankhya ficam só lá.
  SANKHYA_PROXY_URL: optional(z.string().url()),
  SANKHYA_PROXY_CHAVE: optional(z.string().min(1)),
  SANKHYA_CLIENT_ID: optional(z.string().min(1)),
  SANKHYA_CLIENT_SECRET: optional(z.string().min(1)),
  SANKHYA_X_TOKEN: optional(z.string().min(1)),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa ter ao menos 32 caracteres"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  // TOPs (TGFCAB.CODTIPOPER) que contam como venda e como devolução
  SALES_TOPS_VENDA: list(/^\d{1,9}$/).transform((v) => (v.length ? v : ["1110", "1101", "1105", "1112", "1181"]).map(Number)),
  SALES_TOPS_DEVOLUCAO: list(/^\d{1,9}$/).transform((v) => (v.length ? v : ["1201"]).map(Number)),
  // Coluna de custo (TGFCUS) usada na margem bruta do gerente
  MARGEM_CUSTO: z
    .string()
    .regex(/^CUS[A-Z]{2,10}$/, "nome de coluna de TGFCUS, ex.: CUSGER")
    .default("CUSGER"),
  // Empresas que não vendem e ficam fora da tela de metas (CODEMP); padrão Dr. Freitas, Ananindeua e Ultralog
  META_LOJAS_FORA: list(/^\d{1,9}$/).transform((v) => (v.length ? v : ["2", "7", "100"]).map(Number)),
  // Dias da semana com expediente nas metas diárias (0 = domingo … 6 = sábado); padrão segunda a sábado
  META_DIAS_SEMANA: list(/^[0-6]$/).transform((v) => (v.length ? v : ["1", "2", "3", "4", "5", "6"]).map(Number)),
  // Área de admin (/admin/login); sem os dois, o acesso de admin fica desligado.
  // O tamanho mínimo da senha é conferido só no login do admin, para não derrubar o resto do app.
  ADMIN_USER: optional(z.string()),
  ADMIN_PASSWORD: optional(z.string()),
  // Repositório onde o admin abre issues a partir das sugestões
  GITHUB_REPO: optional(z.string().regex(/^[\w.-]+\/[\w.-]+$/, "formato dono/repositorio")).transform((v) => v ?? "lvdamaceno/dashboard_vendas"),
}).superRefine((v, ctx) => {
  const faltando = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.SANKHYA_PROXY_URL) {
    if (!v.SANKHYA_PROXY_CHAVE) faltando("SANKHYA_PROXY_CHAVE", "obrigatório com SANKHYA_PROXY_URL");
    return;
  }
  if (!v.SANKHYA_CLIENT_ID) faltando("SANKHYA_CLIENT_ID", "obrigatório (Área do Desenvolvedor Sankhya)");
  if (!v.SANKHYA_CLIENT_SECRET) faltando("SANKHYA_CLIENT_SECRET", "obrigatório (Área do Desenvolvedor Sankhya)");
  if (!v.SANKHYA_X_TOKEN) faltando("SANKHYA_X_TOKEN", "obrigatório (tela Configurações Gateway no Sankhya)");
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Configuração inválida (.env): ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

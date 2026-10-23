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
  SANKHYA_CLIENT_ID: z.string().min(1, "obrigatório (Área do Desenvolvedor Sankhya)"),
  SANKHYA_CLIENT_SECRET: z.string().min(1, "obrigatório (Área do Desenvolvedor Sankhya)"),
  SANKHYA_X_TOKEN: z.string().min(1, "obrigatório (tela Configurações Gateway no Sankhya)"),
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
  // Dias da semana com expediente nas metas diárias (0 = domingo … 6 = sábado); padrão segunda a sábado
  META_DIAS_SEMANA: list(/^[0-6]$/).transform((v) => (v.length ? v : ["1", "2", "3", "4", "5", "6"]).map(Number)),
  // Área de admin (/admin/login); sem os dois, o acesso de admin fica desligado.
  // O tamanho mínimo da senha é conferido só no login do admin, para não derrubar o resto do app.
  ADMIN_USER: optional(z.string()),
  ADMIN_PASSWORD: optional(z.string()),
  // Repositório onde o admin abre issues a partir das sugestões
  GITHUB_REPO: optional(z.string().regex(/^[\w.-]+\/[\w.-]+$/, "formato dono/repositorio")).transform((v) => v ?? "lvdamaceno/dashboard_vendas"),
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

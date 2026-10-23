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

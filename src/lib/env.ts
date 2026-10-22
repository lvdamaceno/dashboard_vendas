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
  SANKHYA_URL: z.string().url(),
  SANKHYA_SERVICE_USER: z.string().min(1, "obrigatório (usuário de integração com acesso ao DbExplorer)"),
  SANKHYA_SERVICE_PASSWORD: z.string().min(1, "obrigatório"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa ter ao menos 32 caracteres"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  SALES_TIPMOV_VENDA: list(/^[A-Z]$/).transform((v) => (v.length ? v : ["V"])),
  SALES_TIPMOV_DEVOLUCAO: list(/^[A-Z]$/).transform((v) => (v.length ? v : ["D"])),
  SALES_STATUSNOTA: list(/^[A-Z]$/).transform((v) => (v.length ? v : ["L"])),
  SALES_TOPS: list(/^\d{1,9}$/).transform((v) => v.map(Number)),
  MANAGER_TIPVEND: z.string().regex(/^[A-Z]$/).default("G"),
  MANAGER_SCOPE: z.enum(["empresa", "equipe"]).default("empresa"),
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

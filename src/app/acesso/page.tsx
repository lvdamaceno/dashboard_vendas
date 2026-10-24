import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { requirements } from "@/lib/acesso";
import { getSession } from "@/lib/session";
import { LocationCheck } from "./location-check";

/** Só caminhos do próprio painel (nunca outro site) */
const safePath = (v: string | undefined) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard");

/** Confirmação de local: o grupo da pessoa só usa o painel nas lojas e locais cadastrados pelo admin. */
export default async function AccessPage({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const volta = safePath((await searchParams).volta);
  if (!(await requirements(session.role)).locais) redirect(volta);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-6 h-14 w-auto" title="Casa Contente" />
          <h1 className="text-2xl">Confirme onde você está</h1>
          <p className="mt-1 text-sm text-ink-2">O painel só abre nas lojas e locais autorizados. Permita o acesso à localização quando o aparelho pedir.</p>
        </div>
        <LocationCheck volta={volta} />
      </div>
    </main>
  );
}

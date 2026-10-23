import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { listNotices } from "@/lib/painel";
import { todayIso } from "@/lib/period";
import { getSession } from "@/lib/session";
import { HolidaysManager } from "./holidays-manager";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Feriados e dias úteis das metas diárias. Master e admin. */
export default async function HolidaysPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "master" && session.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.ano) ? sp.ano[0] : sp.ano);
  const ano = Number.isSafeInteger(raw) && raw >= 2020 && raw <= 2100 ? raw : Number(todayIso().slice(0, 4));
  const notices = await listNotices(session).catch(() => null);

  let content: React.ReactNode;
  try {
    content = await HolidaysManager({ ano, yearHref: (y) => `/feriados?ano=${y}` });
  } catch (err) {
    console.error("[feriados] erro ao carregar:", err instanceof Error ? err.message : err);
    content = <p className="rounded-3xl border border-line bg-surface p-6 text-center text-sm text-ink-2">Não foi possível carregar. Tente novamente.</p>;
  }

  return (
    <Shell session={session} notices={notices} scope={session.role === "admin" ? "Admin · Feriados" : "Diretoria · Feriados"}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">Feriados</h1>
          <p className="text-sm text-ink-3">Dias sem expediente não entram na conta das metas diárias</p>
        </div>
        <div className="flex gap-2">
          <Link href="/metas" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
            Metas
          </Link>
          <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
            Voltar ao painel
          </Link>
        </div>
      </div>
      {content}
    </Shell>
  );
}

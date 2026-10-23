import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { monthWorkdays } from "@/lib/feriados";
import { listGoals } from "@/lib/metas";
import { listNotices } from "@/lib/painel";
import { todayIso } from "@/lib/period";
import { getStores, getStoreVendors } from "@/lib/sales";
import { getSession } from "@/lib/session";
import { CopyGoals } from "./copy-goals";
import { GoalsForm } from "./goals-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function shiftMonth(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Metas mensais por loja: geral da loja e individual de cada vendedor. Só master e admin. */
export default async function GoalsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "master" && session.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const mesParam = one(sp.mes);
  const mes = mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : todayIso().slice(0, 7);
  const lojaRaw = Number(one(sp.loja));
  const loja = Number.isSafeInteger(lojaRaw) && lojaRaw > 0 ? lojaRaw : undefined;

  const [stores, notices, calendario] = await Promise.all([getStores().catch(() => []), listNotices(session).catch(() => null), monthWorkdays(mes)]);
  const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  let content: React.ReactNode = <p className="py-6 text-center text-sm text-ink-3">Escolha a loja para informar as metas.</p>;
  if (loja) {
    try {
      const [vendedores, metas] = await Promise.all([getStoreVendors(loja), listGoals(`${mes}-01`, loja)]);
      const valor = (codvend: number) => metas.find((m) => m.codvend === codvend)?.valor ?? null;
      content = (
        <GoalsForm
          // Recria o formulário quando as metas mudam (ex.: depois de copiar do mês anterior)
          key={`${loja}-${mes}-${metas.map((m) => `${m.codvend}:${m.valor}`).join(",")}`}
          loja={loja}
          mes={mes}
          metaLoja={valor(0)}
          diasUteis={calendario.dias.length}
          vendedores={vendedores.map((v) => ({ ...v, meta: valor(v.codvend) }))}
        />
      );
    } catch (err) {
      console.error("[metas] erro ao carregar:", err instanceof Error ? err.message : err);
      content = <p className="py-6 text-center text-sm text-ink-2">Não foi possível carregar. Tente novamente em instantes.</p>;
    }
  }

  const link = (params: { loja?: number; mes: string }) => `/metas?${new URLSearchParams({ ...(params.loja ? { loja: String(params.loja) } : {}), mes: params.mes })}`;
  const nav = "flex size-10 items-center justify-center rounded-full border border-line bg-surface text-lg text-ink-2 hover:bg-bg-alt";

  return (
    <Shell session={session} notices={notices} stores={stores} scope={session.role === "admin" ? "Admin · Metas" : "Diretoria · Metas"}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">Metas</h1>
          <p className="text-sm text-ink-3">Faturamento líquido do mês (vendas − devoluções), geral da loja e por vendedor</p>
        </div>
        <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
          Voltar ao painel
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Link href={link({ loja, mes: shiftMonth(mes, -1) })} aria-label="Mês anterior" className={nav}>
            ‹
          </Link>
          <span className="min-w-40 text-center font-title font-medium capitalize">{monthName.format(new Date(`${mes}-01T00:00:00Z`))}</span>
          <Link href={link({ loja, mes: shiftMonth(mes, 1) })} aria-label="Próximo mês" className={nav}>
            ›
          </Link>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Loja">
          {stores.map((s) => (
            <Link
              key={s.codigo}
              href={link({ loja: s.codigo, mes })}
              aria-current={s.codigo === loja ? "page" : undefined}
              className={`h-10 rounded-full px-4 font-title text-sm leading-10 font-medium ${
                s.codigo === loja ? "bg-accent text-white" : "border border-line bg-surface text-ink-2 hover:bg-bg-alt"
              }`}
            >
              {s.nome}
            </Link>
          ))}
        </nav>
      </div>

      <p className="text-sm text-ink-2">
        <strong>{calendario.dias.length} dias úteis</strong> neste mês
        {calendario.feriados.length > 0 && (
          <> (sem {calendario.feriados.map((f) => `${dayFmt.format(new Date(`${f.dia}T12:00:00Z`))} ${f.nome.replace(/ \(.*\)$/, "")}`).join(", ")})</>
        )}
        . A meta diária é a meta do mês dividida pelos dias úteis; o que sobra ou falta num dia passa para o seguinte.{" "}
        <Link href="/feriados" className="font-medium text-accent underline-offset-4 hover:underline">
          Ajustar feriados
        </Link>
      </p>

      <CopyGoals
        key={`${loja ?? ""}-${mes}`}
        mes={mes}
        loja={loja}
        label={`Copiar metas de ${monthName.format(new Date(`${shiftMonth(mes, -1)}-01T00:00:00Z`)).split(" ")[0]}${loja ? " desta loja" : " de todas as lojas"}`}
      />

      <section className="rounded-3xl border border-line bg-surface p-5">{content}</section>
    </Shell>
  );
}

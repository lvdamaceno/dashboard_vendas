import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { monthWorkdays } from "@/lib/feriados";
import { listGoalPeople, listGoals } from "@/lib/metas";
import { listNotices } from "@/lib/painel";
import { todayIso } from "@/lib/period";
import { getStores, salesPeopleByStore } from "@/lib/sales";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { CopyGoals } from "./copy-goals";
import { GoalsForm } from "./goals-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function shiftMonth(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Metas do mês de todas as lojas: meta da loja, meta por vendedor (a mesma para cada pessoa marcada) e quem conta. Só master e admin. */
export default async function GoalsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "master" && session.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const mesParam = Array.isArray(sp.mes) ? sp.mes[0] : sp.mes;
  const mes = mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : todayIso().slice(0, 7);
  const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  const [notices, calendario] = await Promise.all([listNotices(session).catch(() => null), monthWorkdays(mes)]);

  let content: React.ReactNode;
  let stores: { codigo: number; nome: string }[] = [];
  try {
    // Empresas que não vendem (META_LOJAS_FORA) não recebem meta
    stores = (await getStores()).filter((s) => !env().META_LOJAS_FORA.includes(s.codigo));
    const [metas, pessoas, candidatos] = await Promise.all([listGoals(`${mes}-01`), listGoalPeople(`${mes}-01`), salesPeopleByStore()]);
    const linhas = stores.map((s) => {
      const marcados = pessoas.filter((p) => p.codemp === s.codigo);
      // Candidatos: quem vendeu na loja nos últimos 90 dias, mais quem já está marcado
      const opcoes = [
        ...marcados.map((p) => ({ codvend: p.codvend, nome: p.nome, notas: candidatos.find((c) => c.codemp === s.codigo && c.codvend === p.codvend)?.notas ?? 0 })),
        ...candidatos.filter((c) => c.codemp === s.codigo && !marcados.some((p) => p.codvend === c.codvend)),
      ].map((o) => ({ ...o, outraLoja: pessoas.find((p) => p.codvend === o.codvend && p.codemp !== s.codigo) ? true : false }));
      return {
        ...s,
        loja: metas.get(s.codigo)?.loja ?? null,
        vendedor: metas.get(s.codigo)?.vendedor ?? null,
        pessoas: opcoes,
        marcados: marcados.map((p) => p.codvend),
      };
    });
    content = (
      <GoalsForm
        // Recria o formulário quando as metas mudam (ex.: depois de copiar do mês anterior)
        key={`${mes}-${linhas.map((l) => `${l.loja}:${l.vendedor}:${l.marcados.join("+")}`).join(",")}`}
        mes={mes}
        diasUteis={calendario.dias.length}
        lojas={linhas}
      />
    );
  } catch (err) {
    console.error("[metas] erro ao carregar:", err instanceof Error ? err.message : err);
    content = <p className="py-6 text-center text-sm text-ink-2">Não foi possível carregar. Tente novamente em instantes.</p>;
  }

  const nav = "flex size-10 items-center justify-center rounded-full border border-line bg-surface text-lg text-ink-2 hover:bg-bg-alt";

  return (
    <Shell session={session} notices={notices} stores={stores} scope={session.role === "admin" ? "Admin · Metas" : "Diretoria · Metas"}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">Metas</h1>
          <p className="text-sm text-ink-3">Faturamento líquido do mês (vendas − devoluções)</p>
        </div>
        <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
          Voltar ao painel
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/metas?mes=${shiftMonth(mes, -1)}`} aria-label="Mês anterior" className={nav}>
            ‹
          </Link>
          <span className="min-w-40 text-center font-title font-medium">{upperFirst(monthName.format(new Date(`${mes}-01T00:00:00Z`)))}</span>
          <Link href={`/metas?mes=${shiftMonth(mes, 1)}`} aria-label="Próximo mês" className={nav}>
            ›
          </Link>
        </div>
        <CopyGoals key={mes} mes={mes} label={`Copiar metas de ${monthName.format(new Date(`${shiftMonth(mes, -1)}-01T00:00:00Z`)).split(" ")[0]}`} />
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

      <section className="rounded-3xl border border-line bg-surface p-5">{content}</section>
    </Shell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { PersonPicker } from "@/components/person-picker";
import { PhoneList } from "@/components/phone-editor";
import { listEditablePhones } from "../painel-actions";
import { Shell } from "@/components/shell";
import { env } from "@/lib/env";
import { countPendingFeedback, listFeedback, listMasters, listNotices, type Feedback } from "@/lib/painel";
import { listPeopleForAdmin } from "@/lib/people";
import { getStores } from "@/lib/sales";
import { getSession } from "@/lib/session";
import { deleteMaster, removeNotice, toggleFeedback } from "./actions";
import { ConfirmButton, MasterForm, NoticeForm } from "./forms";
import { HolidaysManager } from "../feriados/holidays-manager";
import { todayIso } from "@/lib/period";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  { value: "sugestoes", label: "Sugestões e erros" },
  { value: "avisos", label: "Avisos" },
  { value: "masters", label: "Usuários master" },
  { value: "paineis", label: "Ver painéis" },
  { value: "telefones", label: "Telefones" },
  { value: "feriados", label: "Feriados" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const FILTERS = [
  { value: "pendentes", label: "Pendentes" },
  { value: "concluidos", label: "Concluídos" },
  { value: "todos", label: "Todos" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const ROLES: Record<string, string> = { vendedor: "Vendedor", gerente: "Gerente", master: "Diretoria", admin: "Admin" };

const card = "rounded-3xl border border-line bg-surface p-5";
const small = "h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium hover:bg-bg-alt";

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab: Tab = TABS.find((t) => t.value === one(sp.aba))?.value ?? "sugestoes";
  const filter: Filter = FILTERS.find((f) => f.value === one(sp.filtro))?.value ?? "pendentes";

  // Lojas vêm do Sankhya (nomes nos avisos e nos painéis); se falhar, mostra o código
  const stores = await getStores().catch((err) => {
    console.error("[admin] lojas:", err instanceof Error ? err.message : err);
    return [];
  });
  const storeName = (codemp: number | null) => (codemp ? (stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`) : "Todas as lojas");

  let content: React.ReactNode;
  try {
    content = await renderTab();
  } catch (err) {
    console.error(`[admin] ${tab}:`, err instanceof Error ? err.message : err);
    content = <p className={`${card} text-center text-sm text-ink-2`}>Não foi possível carregar. Tente novamente em instantes.</p>;
  }
  const pending = await countPendingFeedback().catch(() => 0);

  return (
    <Shell session={session} scope="Administração" feedback={false}>
      <h1 className="text-2xl">Administração</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Seções">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin?aba=${t.value}`}
            aria-current={t.value === tab ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-title text-sm font-medium ${
              t.value === tab ? "bg-accent text-white" : "border border-line bg-surface text-ink-2 hover:bg-bg-alt"
            }`}
          >
            {t.label}
            {t.value === "sugestoes" && pending > 0 && (
              <span className={`rounded-full px-2 text-xs ${t.value === tab ? "bg-white/25" : "bg-accent-soft text-accent"}`}>{pending}</span>
            )}
          </Link>
        ))}
        {/* Metas e feriados têm telas próprias (as mesmas que a diretoria usa) */}
        <Link href="/metas" className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 font-title text-sm font-medium text-ink-2 hover:bg-bg-alt">
          Metas ↗
        </Link>
      </nav>
      {content}
    </Shell>
  );

  async function renderTab() {
    if (tab === "avisos") {
      const notices = await listNotices(session!, 100);
      return (
        <>
          <section className={card}>
            <h2 className="mb-3 text-base">Novo aviso</h2>
            <NoticeForm stores={stores} />
          </section>
          <section className={card}>
            <h2 className="mb-3 text-base">Avisos enviados</h2>
            {notices.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">Nenhum aviso ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notices.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{n.titulo}</p>
                      <p className="mt-0.5 text-sm whitespace-pre-line text-ink-2">{n.mensagem}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {n.autorNome} ({ROLES[n.autorPapel]}) · {storeName(n.codemp)} · {when.format(n.criadoEm)}
                      </p>
                    </div>
                    <form action={removeNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <ConfirmButton message="Apagar este aviso para todos?" className={small}>
                        Apagar
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      );
    }

    if (tab === "masters") {
      const masters = await listMasters();
      return (
        <>
          <section className={card}>
            <h2 className="mb-1 text-base">Adicionar master</h2>
            <p className="mb-3 text-sm text-ink-2">Diretores entram com o CPF e veem todas as lojas, sem precisar de cadastro no Sankhya.</p>
            <MasterForm />
          </section>
          <section className={card}>
            <h2 className="mb-3 text-base">Masters cadastrados</h2>
            {masters.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">Nenhum master cadastrado.</p>
            ) : (
              <ul className="divide-y divide-line">
                {masters.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.nome}</p>
                      <p className="tabular text-xs text-ink-3">CPF ***.{m.cpf.slice(3, 6)}.{m.cpf.slice(6, 9)}-**</p>
                    </div>
                    <form action={deleteMaster}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton message={`Remover o acesso de ${m.nome}?`} className={small}>
                        Remover
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      );
    }

    if (tab === "feriados") {
      const anoParam = Number(one(sp.ano));
      const ano = Number.isSafeInteger(anoParam) && anoParam >= 2020 && anoParam <= 2100 ? anoParam : Number(todayIso().slice(0, 4));
      return <HolidaysManager ano={ano} yearHref={(y) => `/admin?aba=feriados&ano=${y}`} />;
    }

    if (tab === "telefones") {
      const people = await listEditablePhones();
      if ("error" in people) throw new Error(people.error);
      return (
        <section className={card}>
          <h2 className="mb-1 text-base">Telefones do cartão de visita</h2>
          <p className="mb-3 text-sm text-ink-2">
            O telefone salvo aqui vale no cartão e no QR code do WhatsApp. Sem telefone salvo no app, vale o do Sankhya.
          </p>
          <PhoneList people={people} stores={stores} />
        </section>
      );
    }

    if (tab === "paineis") {
      const people = await listPeopleForAdmin();
      return (
        <section className={card}>
          <h2 className="mb-1 text-base">Ver o painel de um master, gerente ou vendedor</h2>
          <p className="mb-3 text-sm text-ink-2">
            Escolha pelo nome para ver o painel exatamente como a pessoa vê. Para ver todas as lojas, abra o{" "}
            <Link href="/dashboard" className="text-accent underline-offset-4 hover:underline">
              painel de vendas
            </Link>
            .
          </p>
          <PersonPicker people={people} stores={stores} />
        </section>
      );
    }

    const items = await listFeedback(filter);
    return (
      <section className={card}>
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin?aba=sugestoes&filtro=${f.value}`}
              className={`h-9 rounded-full px-4 text-sm leading-9 font-medium ${f.value === filter ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-bg-alt"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">Nada por aqui.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((f) => (
              <li key={f.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${f.tipo === "erro" ? "bg-accent-soft text-bad" : "bg-smile/25"}`}>
                    {f.tipo === "erro" ? "Erro" : "Sugestão"}
                  </span>
                  {f.concluido && <span className="rounded-full bg-good/15 px-2 py-0.5 font-medium text-good">Concluído</span>}
                  <span className="text-ink-3">
                    {f.autorNome} · {ROLES[f.autorPapel] ?? f.autorPapel}
                    {f.codemp ? ` · ${storeName(f.codemp)}` : ""} · {when.format(f.criadoEm)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-line">{f.mensagem}</p>
                {f.pagina && <p className="truncate text-xs text-ink-3" title={f.navegador ?? undefined}>Página: {f.pagina}</p>}
                <div className="flex flex-wrap gap-2">
                  <form action={toggleFeedback}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="concluido" value={f.concluido ? "0" : "1"} />
                    <button type="submit" className={small}>
                      {f.concluido ? "Reabrir" : "Marcar como concluído"}
                    </button>
                  </form>
                  <a href={issueUrl(f)} target="_blank" rel="noopener noreferrer" className={`${small} leading-9`}>
                    Criar issue no GitHub ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  /**
   * Abre o formulário de nova issue já preenchido (o admin revisa antes de criar).
   * O repositório é público: vai só a mensagem, sem nome de quem enviou nem navegador.
   */
  function issueUrl(f: Feedback) {
    const tipo = f.tipo === "erro" ? "Erro" : "Sugestão";
    const resumo = f.mensagem.replace(/\s+/g, " ").trim();
    const title = `${tipo}: ${resumo.length > 70 ? `${resumo.slice(0, 70)}…` : resumo}`;
    const body = [
      `**${tipo}**, enviado pelo painel (${ROLES[f.autorPapel] ?? f.autorPapel}${f.codemp ? `, ${storeName(f.codemp)}` : ""}) em ${when.format(f.criadoEm)}.`,
      "",
      f.mensagem,
      "",
      f.pagina ? `Página: \`${f.pagina.split("?")[0]}\`` : "",
      `Registro #${f.id} no admin.`,
    ].join("\n");
    const params = new URLSearchParams({ title, body });
    return `https://github.com/${env().GITHUB_REPO}/issues/new?${params}`;
  }
}

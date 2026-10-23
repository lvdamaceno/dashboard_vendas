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
import { deleteMaster, removeNotice, removeReminder, resetMasterPasswordAction, toggleFeedback, toggleReminder } from "./actions";
import { ConfirmButton, MasterForm, NoticeForm, ReminderForm } from "./forms";
import { listReminders, nextOccurrence, type Reminder } from "@/lib/lembretes";
import { configChecks, connectionChecks, searchLogs, serverInfo, usageStats, type Check } from "@/lib/health";
import type { Nivel } from "@/lib/monitor";
import { HolidaysManager } from "../feriados/holidays-manager";
import { todayIso } from "@/lib/period";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  { value: "saude", label: "Saúde" },
  { value: "sugestoes", label: "Sugestões e erros" },
  { value: "avisos", label: "Avisos" },
  { value: "lembretes", label: "Lembretes" },
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
            <p className="mb-3 text-sm text-ink-2">
              Diretores entram com o CPF e uma senha, que eles mesmos criam no primeiro acesso, e veem todas as lojas, sem precisar de
              cadastro no Sankhya. Peça para fazerem o primeiro acesso logo: até criarem a senha, quem souber o CPF poderia criá-la.
            </p>
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
                      <p className="tabular text-xs text-ink-3">
                        CPF ***.{m.cpf.slice(3, 6)}.{m.cpf.slice(6, 9)}-** ·{" "}
                        {m.senhaEm ? (
                          <>senha criada em {when.format(m.senhaEm)}</>
                        ) : (
                          <span className="font-medium text-bad">ainda não criou a senha (primeiro acesso pendente)</span>
                        )}
                      </p>
                    </div>
                    {m.senhaEm && (
                      <form action={resetMasterPasswordAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton message={`Zerar a senha de ${m.nome}? No próximo acesso ele cria outra.`} className={small}>
                          Zerar senha
                        </ConfirmButton>
                      </form>
                    )}
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

    if (tab === "saude") {
      const nivelParam = one(sp.nivel);
      const nivel: Nivel | "todos" = nivelParam === "error" || nivelParam === "warn" || nivelParam === "info" ? nivelParam : "todos";
      const fonte = one(sp.fonte) === "memoria" ? "memoria" : "banco";
      const q = (one(sp.q) ?? "").slice(0, 100);
      const [conexoes, uso, logs] = await Promise.all([
        connectionChecks(),
        usageStats().catch(() => null),
        searchLogs(fonte, q, nivel).catch(() => []),
      ]);
      const servidor = serverInfo();
      const config = configChecks();
      const problemas = [!conexoes.postgres.ok && "banco do painel", !conexoes.sankhya.ok && "Sankhya", ...config.filter((c) => !c.ok).map((c) => c.nome)].filter(Boolean);
      const atencao = !problemas.length && ((uso?.erros_24h ?? 0) > 0 || conexoes.sankhya.ms > 5000);
      const fmtHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
      const duracao = (ms: number) => {
        const min = Math.floor(ms / 60_000);
        return min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} dias`;
      };
      const Dot = ({ ok, warn }: { ok: boolean; warn?: boolean }) => (
        <span className={`inline-block size-2.5 shrink-0 rounded-full ${ok ? (warn ? "bg-smile" : "bg-good") : "bg-bad"}`} aria-hidden />
      );
      const Conn = ({ nome, c }: { nome: string; c: Check }) => (
        <li className="flex items-start gap-3 py-3">
          <span className="mt-1.5">
            <Dot ok={c.ok} warn={c.ok && c.ms > 3000} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {nome} <span className="tabular text-sm font-normal text-ink-3">· {c.ms} ms</span>
            </p>
            <p className={`text-sm break-words ${c.ok ? "text-ink-2" : "text-bad"}`}>{c.detalhe}</p>
          </div>
        </li>
      );
      const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "bad" | "good" }) => (
        <div className="rounded-2xl border border-line p-3">
          <p className="text-xs text-ink-3">{label}</p>
          <p className={`tabular mt-0.5 font-title text-xl font-semibold ${tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : ""}`}>{value}</p>
        </div>
      );
      const s = servidor.sankhya;
      const linkLogs = (p: Record<string, string>) => `/admin?${new URLSearchParams({ aba: "saude", fonte, nivel, q, ...p })}`;
      return (
        <>
          <section className={`${card} flex items-center gap-3 ${problemas.length ? "border-bad/40 bg-accent-soft" : atencao ? "border-smile/60" : "border-good/40"}`}>
            <Dot ok={!problemas.length} warn={atencao} />
            <div className="min-w-0 flex-1">
              <p className="font-title font-medium">
                {problemas.length ? `Com problema: ${problemas.join(", ")}` : atencao ? "Funcionando, com pontos de atenção" : "Tudo funcionando"}
              </p>
              <p className="text-xs text-ink-3">Verificado agora · {fmtHora.format(new Date())}</p>
            </div>
            <Link href={linkLogs({})} className={`${small} leading-9`}>
              Atualizar
            </Link>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className={card}>
              <h2 className="text-base">Conexões externas</h2>
              <ul className="divide-y divide-line">
                <Conn nome="Banco do painel (Postgres)" c={conexoes.postgres} />
                <Conn nome="Sankhya (API oficial)" c={conexoes.sankhya} />
              </ul>
              {s.ultimoErro && (
                <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-bad">
                  Último erro do Sankhya ({fmtHora.format(new Date(s.ultimoErro.at))}): {s.ultimoErro.msg}
                </p>
              )}
            </section>
            <section className={card}>
              <h2 className="mb-2 text-base">Servidor</h2>
              <ul className="space-y-1.5 text-sm">
                <li>
                  No ar há <strong>{duracao(Date.now() - servidor.noArDesde)}</strong> (desde {fmtHora.format(new Date(servidor.noArDesde))})
                </li>
                <li>
                  Memória: <strong className="tabular">{servidor.memoriaMb} MB</strong> <span className="text-ink-3">(heap {servidor.heapMb} MB)</span>
                </li>
                <li className="text-ink-2">
                  Node {servidor.node}
                  {servidor.commit && <> · versão {servidor.commit}</>}
                  {servidor.instancia && <> · {servidor.instancia}</>}
                </li>
              </ul>
              <h3 className="mt-4 mb-1 text-sm font-medium">Configuração</h3>
              <ul className="space-y-1 text-sm">
                {config.map((c) => (
                  <li key={c.nome} className="flex items-center gap-2">
                    <Dot ok={c.ok} />
                    <span className={c.ok ? "text-ink-2" : "text-bad"}>{c.nome}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={card}>
            <h2 className="mb-1 text-base">Uso</h2>
            <p className="mb-3 text-xs text-ink-3">Desde o último reinício do servidor</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Consultas ao Sankhya" value={s.chamadas} />
              <Stat label="Falhas do Sankhya" value={s.falhas} tone={s.falhas ? "bad" : undefined} />
              <Stat label="Tempo médio / p95" value={`${s.medio} / ${s.p95} ms`} />
              <Stat label="Respostas do cache" value={s.chamadas + s.cache ? `${Math.round((s.cache / (s.chamadas + s.cache)) * 100)}%` : "—"} />
              <Stat label="Logins aceitos" value={servidor.logins.ok} />
              <Stat label="Logins recusados" value={servidor.logins.recusados} tone={servidor.logins.recusados > 10 ? "bad" : undefined} />
            </div>
            {uso && (
              <>
                <p className="mt-4 mb-3 text-xs text-ink-3">Pelo banco do painel</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Acessos hoje" value={uso.logins_hoje} />
                  <Stat label="Acessos em 7 dias" value={`${uso.logins_7d} · ${uso.pessoas_7d} pessoas`} />
                  <Stat label="Erros em 24h" value={uso.erros_24h} tone={uso.erros_24h ? "bad" : "good"} />
                  <Stat label="Alertas em 24h" value={uso.alertas_24h} />
                  <Stat label="Na fila hoje" value={`${uso.fila_hoje} · ${uso.fila_atendendo} atendendo`} />
                  <Stat label="Sugestões pendentes" value={uso.sugestoes_pendentes} />
                  <Stat label="Avisos em 7 dias" value={uso.avisos_7d} />
                  <Stat label="Lojas com meta no mês" value={uso.lojas_com_meta} />
                  <Stat label="Masters" value={uso.masters} />
                  <Stat label="Lembretes ativos" value={uso.lembretes_ativos} />
                  <Stat label="Fotos na fila" value={uso.fotos} />
                  <Stat label="Celulares com notificação" value={uso.celulares} />
                </div>
              </>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-3 text-base">Logs</h2>
            <form action="/admin" className="mb-3 flex flex-wrap gap-2">
              <input type="hidden" name="aba" value="saude" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Procurar (ex.: sankhya, login, erro, nome)"
                className="h-10 min-w-0 flex-1 basis-56 rounded-full border border-line bg-bg px-4 text-base outline-none focus:border-accent md:text-sm"
              />
              <select name="nivel" defaultValue={nivel} aria-label="Nível" className="h-10 rounded-full border border-line bg-bg px-3 text-sm">
                <option value="todos">Todos os níveis</option>
                <option value="error">Erros</option>
                <option value="warn">Alertas</option>
                <option value="info">Informações</option>
              </select>
              <select name="fonte" defaultValue={fonte} aria-label="De onde" className="h-10 rounded-full border border-line bg-bg px-3 text-sm">
                <option value="banco">Últimos 30 dias (erros, alertas e acessos)</option>
                <option value="memoria">Desde o último reinício (tudo)</option>
              </select>
              <button type="submit" className="h-10 rounded-full bg-accent px-5 font-title text-sm font-medium text-white hover:bg-accent-dark">
                Procurar
              </button>
            </form>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">Nada encontrado.</p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto rounded-2xl border border-line font-mono text-xs">
                {logs.map((l, i) => (
                  <li key={`${l.at}-${i}`} className="flex gap-3 px-3 py-2">
                    <span className="tabular shrink-0 text-ink-3">{fmtHora.format(new Date(l.at))}</span>
                    <span
                      className={`shrink-0 font-semibold ${l.nivel === "error" ? "text-bad" : l.nivel === "warn" ? "text-[#a86a00]" : "text-ink-3"}`}
                    >
                      {l.nivel === "error" ? "ERRO" : l.nivel === "warn" ? "ALERTA" : "INFO"}
                    </span>
                    <span className="min-w-0 break-words whitespace-pre-wrap">{l.msg}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-3">
              Mostrando até 200 linhas, das mais novas para as mais antigas. O log completo da hospedagem fica no painel do Render.
            </p>
          </section>
        </>
      );
    }

    if (tab === "lembretes") {
      const lembretes = await listReminders();
      const hoje = todayIso();
      const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
      const quando = (r: Reminder) =>
        r.recorrencia === "mensal"
          ? `Todo dia ${r.dia} do mês`
          : r.recorrencia === "semanal"
            ? `Toda ${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][r.dia ?? 0]}`
            : r.recorrencia === "diaria"
              ? "Todo dia"
              : `Uma vez, em ${fmt.format(new Date(`${r.data}T12:00:00Z`))}`;
      const publico = { master: "Diretoria", gerente: "Gerentes", vendedor: "Vendedores", todos: "Todo mundo" };
      return (
        <>
          <section className={card}>
            <h2 className="mb-1 text-base">Novo lembrete</h2>
            <p className="mb-3 text-sm text-ink-2">
              No dia, o lembrete aparece no sino de avisos de quem você escolher (na primeira vez que a pessoa abrir o painel).
            </p>
            <ReminderForm />
          </section>
          <section className={card}>
            <h2 className="mb-3 text-base">Lembretes</h2>
            {lembretes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">Nenhum lembrete ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {lembretes.map((r) => {
                  const proximo = nextOccurrence(r, hoje);
                  return (
                    <li key={r.id} className={`flex flex-wrap items-start gap-3 py-3 ${r.ativo ? "" : "opacity-60"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.titulo}</p>
                        <p className="mt-0.5 text-sm whitespace-pre-line text-ink-2">{r.mensagem}</p>
                        <p className="mt-1 text-xs text-ink-3">
                          {publico[r.publico]} · {quando(r)}
                          {r.ativo && proximo && <> · próximo: {fmt.format(new Date(`${proximo}T12:00:00Z`))}</>}
                          {r.ultimoEnvio && <> · último envio: {fmt.format(new Date(`${r.ultimoEnvio}T12:00:00Z`))}</>}
                          {!r.ativo && <> · pausado</>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form action={toggleReminder}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="ativo" value={r.ativo ? "0" : "1"} />
                          <button type="submit" className={small}>
                            {r.ativo ? "Pausar" : "Retomar"}
                          </button>
                        </form>
                        <form action={removeReminder}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmButton message={`Apagar o lembrete "${r.titulo}"?`} className={small}>
                            Apagar
                          </ConfirmButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
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

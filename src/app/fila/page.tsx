import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { photoVersion } from "@/lib/fila";
import { loadQueue, queueStore, type QueueView } from "@/lib/fila-access";
import { listNotices } from "@/lib/painel";
import { getStores, vendorStore } from "@/lib/sales";
import { getSession } from "@/lib/session";
import { QueueBoard, StorePicker } from "./queue-board";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Fila de atendimento:
 *  - vendedor e gerente: só a fila da própria loja, sem seletor;
 *  - admin vendo o painel de um gerente/vendedor: a fila da loja dessa pessoa, com os controles de gerente;
 *  - master: escolhe a loja;
 *  - admin: todas as filas de uma vez (cada uma editável) ou uma loja escolhida.
 */
export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.loja) ? sp.loja[0] : sp.loja);
  const lojaParam = Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
  const como = session.role === "admin" ? session.como : undefined;
  const admin = session.role === "admin" && !como;
  const choosesStore = session.role === "master" || admin;

  // Loja da fila: a da pessoa que o admin está vendo, a escolhida (master/admin) ou a da sessão
  const lojaComo = async () => {
    if (!como) return null;
    if (como.role === "gerente") return como.codemp || null;
    if (como.role === "vendedor") return vendorStore(como.codvend, 5 * 60_000);
    return lojaParam ?? null;
  };

  const [stores, notices, codemp, foto] = await Promise.all([
    // Também para o vendedor: o nome da loja aparece no topo da fila
    getStores().catch(() => []),
    listNotices(session).catch(() => null),
    (como ? lojaComo() : queueStore(session, lojaParam)).catch((err) => {
      console.error("[fila] loja:", err instanceof Error ? err.message : err);
      return null;
    }),
    session.role === "vendedor" ? photoVersion(session.codvend).catch(() => null) : null,
  ]);
  const nomeLoja = (c: number) => stores.find((s) => s.codigo === c)?.nome ?? `Loja ${c}`;

  // Admin sem loja escolhida: todas as filas, uma embaixo da outra
  if (admin && !lojaParam) {
    const filas = await Promise.all(
      stores.map(async (s) => ({ loja: s, view: await loadQueue(session, s.codigo).catch(() => null) })),
    );
    return (
      <Shell session={session} notices={notices} stores={stores} scope="Admin · Filas">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl">Filas de atendimento</h1>
            <p className="text-sm text-ink-3">Todas as lojas · zeram todo dia às 7h · atualizam sozinhas</p>
          </div>
          <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
            Voltar ao painel
          </Link>
        </div>
        <StorePicker stores={stores} allOption />
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {filas.map(({ loja, view }) => (
            <QueueBoard
              key={loja.codigo}
              compact
              initial={view}
              error={view ? undefined : "Não foi possível carregar esta fila."}
              role="admin"
              me={null}
              loja={loja.codigo}
              lojaNome={loja.nome}
              stores={[]}
            />
          ))}
        </div>
      </Shell>
    );
  }

  let view: QueueView | null = null;
  let error: string | undefined;
  if (codemp) {
    view = await loadQueue(session, codemp).catch((err) => {
      console.error("[fila] erro ao carregar:", err instanceof Error ? err.message : err);
      error = "Não foi possível carregar a fila. Tente novamente.";
      return null;
    });
  } else if (!choosesStore && !como) {
    error = "Não encontramos a sua loja no cadastro de vendedores.";
  } else if (como) {
    error = "Não encontramos a loja desta pessoa no cadastro de vendedores.";
  }

  return (
    <Shell session={session} notices={notices} stores={stores}>
      <QueueBoard
        key={codemp ?? "sem-loja"}
        initial={view}
        error={error}
        // Admin vendo como alguém: vê e organiza a fila dessa loja, como o gerente
        role={como ? "gerente" : session.role}
        me={session.role === "vendedor" ? { codvend: session.codvend, nome: session.apelido, foto } : null}
        // O admin age sempre pela loja informada (ações e atualização)
        loja={session.role === "admin" ? (codemp ?? undefined) : choosesStore ? lojaParam : undefined}
        lojaNome={codemp ? nomeLoja(codemp) : undefined}
        stores={choosesStore ? stores : []}
        allOption={admin}
      />
    </Shell>
  );
}

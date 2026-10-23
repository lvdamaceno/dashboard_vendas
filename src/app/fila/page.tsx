import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { photoVersion } from "@/lib/fila";
import { loadQueue, queueStore, type QueueView } from "@/lib/fila-access";
import { listNotices } from "@/lib/painel";
import { getStores } from "@/lib/sales";
import { getSession } from "@/lib/session";
import { QueueBoard } from "./queue-board";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.loja) ? sp.loja[0] : sp.loja);
  const lojaParam = Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
  const choosesStore = session.role === "master" || session.role === "admin";

  const [stores, notices, codemp, foto] = await Promise.all([
    // Também para o vendedor: o nome da loja aparece no topo da fila
    getStores().catch(() => []),
    listNotices(session).catch(() => null),
    queueStore(session, lojaParam).catch((err) => {
      console.error("[fila] loja:", err instanceof Error ? err.message : err);
      return null;
    }),
    session.role === "vendedor" ? photoVersion(session.codvend).catch(() => null) : null,
  ]);

  let view: QueueView | null = null;
  let error: string | undefined;
  if (codemp) {
    view = await loadQueue(session, codemp).catch((err) => {
      console.error("[fila] erro ao carregar:", err instanceof Error ? err.message : err);
      error = "Não foi possível carregar a fila. Tente novamente.";
      return null;
    });
  } else if (!choosesStore) {
    error = "Não encontramos a sua loja no cadastro de vendedores.";
  }
  const lojaNome = codemp ? (stores.find((s) => s.codigo === codemp)?.nome ?? `Loja ${codemp}`) : undefined;

  return (
    <Shell session={session} notices={notices} stores={stores}>
      <QueueBoard
        key={codemp ?? "sem-loja"}
        initial={view}
        error={error}
        role={session.role}
        me={session.role === "vendedor" ? { codvend: session.codvend, nome: session.apelido, foto } : null}
        loja={choosesStore ? lojaParam : undefined}
        lojaNome={lojaNome}
        stores={choosesStore ? stores : []}
      />
    </Shell>
  );
}

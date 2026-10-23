import { NextResponse, type NextRequest } from "next/server";
import { loadQueue, queueStore } from "@/lib/fila-access";
import { getSession } from "@/lib/session";

// Atualização da fila (a tela chama a cada poucos segundos). Mesmas regras de acesso das ações.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const param = Number(request.nextUrl.searchParams.get("loja"));
  try {
    const codemp = await queueStore(session, Number.isSafeInteger(param) && param > 0 ? param : undefined);
    if (!codemp) return NextResponse.json({ error: "Escolha a loja." }, { status: 400 });
    return NextResponse.json(await loadQueue(session, codemp), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[fila] erro ao carregar:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível carregar a fila." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { blackFridayAtiva } from "@/lib/black-friday";
import { buscarProdutosBF } from "@/lib/black-friday-produtos";
import { getSession } from "@/lib/session";

// Consulta de descontos da Black Friday: para quem está logado e enquanto o admin deixar ligada.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  try {
    if (!(await blackFridayAtiva())) return NextResponse.json({ error: "A consulta da Black Friday foi encerrada." }, { status: 403 });
  } catch (err) {
    console.error("[black-friday] erro ao consultar:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível consultar agora. Tente novamente em instantes." }, { status: 500 });
  }
  const busca = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  return NextResponse.json(buscarProdutosBF(busca), { headers: { "Cache-Control": "no-store" } });
}

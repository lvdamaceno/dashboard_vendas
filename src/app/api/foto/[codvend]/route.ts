import type { NextRequest } from "next/server";
import { getPhoto } from "@/lib/fila";
import { getSession } from "@/lib/session";

// Foto do vendedor na fila. Só para quem está logado; a URL leva ?v=<versão>, então dá para guardar em cache.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ codvend: string }> }) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const codvend = Number((await params).codvend);
  if (!Number.isSafeInteger(codvend) || codvend <= 0) return new Response(null, { status: 404 });

  const dados = await getPhoto(codvend).catch(() => null);
  if (!dados) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(dados), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}

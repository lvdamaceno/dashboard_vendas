import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkPlace, CLEAR_LOCAL_COOKIE, placeCookie, requirements } from "@/lib/acesso";
import { getSession } from "@/lib/session";

/** Se o grupo de quem está logado precisa confirmar o local (a tela só pede a localização nesse caso). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { locais } = await requirements(session.role);
  return NextResponse.json({ exigido: Boolean(locais) }, { headers: { "Cache-Control": "no-store" } });
}

const posicao = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisao: z.number().nonnegative().max(1_000_000),
});

const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** Confere a localização do aparelho; dentro de um local cadastrado, libera por alguns minutos (cookie). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = posicao.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });

  const { locais } = await requirements(session.role);
  if (!locais) return NextResponse.json({ ok: true });

  const r = checkPlace(locais, parsed.data);
  if (r.ok) {
    const res = NextResponse.json({ ok: true, local: r.local.nome });
    res.cookies.set(await placeCookie(session, r.local.id));
    return res;
  }
  const { precisao } = parsed.data;
  console.warn(
    `[acesso] ${session.apelido} (${session.role}) fora dos locais permitidos: ${
      r.motivo === "impreciso" ? `localização imprecisa (±${Math.round(precisao)} m)` : `a ${fmtDist(r.maisPerto!.distancia)} de ${r.maisPerto!.nome}`
    }`,
  );
  const res = NextResponse.json({
    ok: false,
    error:
      r.motivo === "impreciso"
        ? `Não deu para saber com precisão onde você está (margem de ${fmtDist(Math.round(precisao))}). Ligue o GPS ou o Wi-Fi do aparelho e tente de novo.`
        : `O painel só abre nas lojas e locais autorizados. Você está a ${fmtDist(r.maisPerto!.distancia)} de ${r.maisPerto!.nome}.`,
  });
  res.cookies.set(CLEAR_LOCAL_COOKIE);
  return res;
}

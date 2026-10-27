import { NextResponse, type NextRequest } from "next/server";
import { CLEAR_LOCAL_COOKIE, LOCAL_COOKIE, requirements, scheduleBlock, validPlaceCookie } from "@/lib/acesso";
import { ADMIN_HINT_COOKIE, CLEAR_SESSION_COOKIE, decryptSession, SESSION_COOKIE } from "@/lib/session";

// Barreira inicial: sem sessão válida, nada além do login é acessível.
// As páginas revalidam a sessão por conta própria (defesa em profundidade).
export async function proxy(request: NextRequest) {
  // Server Action com ID fora do formato do Next (42 hex) só vem de bots de varredura: recusa sem tocar em sessão nem banco
  const action = request.headers.get("next-action");
  if (action !== null && !/^[0-9a-f]{42}$/i.test(action)) {
    return new NextResponse(null, { status: 400 });
  }

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  // Login de admin fica aberto mesmo com sessão de vendedor (entrar como admin troca a sessão)
  if (pathname === "/admin/login") {
    return session?.role === "admin" ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  // /admin sem sessão de admin mostra o login de admin no próprio endereço (entrar troca a sessão)
  if (isAdminArea && session?.role !== "admin") return NextResponse.rewrite(new URL("/admin/login", request.url));
  if (!session) {
    // Último acesso deste aparelho foi de admin: volta para o login de admin
    const res = NextResponse.redirect(new URL(request.cookies.get(ADMIN_HINT_COOKIE) ? "/admin" : "/login", request.url));
    res.cookies.set(CLEAR_SESSION_COOKIE);
    return res;
  }

  // Horário e local permitidos para o grupo (aba "Horário e local" do admin)
  const exige = await requirements(session.role);
  const isApi = pathname.startsWith("/api/");
  const bloqueio = exige.horario && scheduleBlock(exige.horario);
  if (bloqueio) {
    // Fora do horário a sessão acaba; o login explica até quando
    console.info(`[login] ${session.apelido} (${session.role}) desconectado: fora do horário de acesso`);
    const res = isApi
      ? NextResponse.json({ error: bloqueio }, { status: 401 })
      : NextResponse.redirect(new URL("/login?fora=horario", request.url));
    res.cookies.set(CLEAR_SESSION_COOKIE);
    res.cookies.set(CLEAR_LOCAL_COOKIE);
    return res;
  }
  // A tela /acesso e /api/acesso confirmam o local, então ficam abertas para quem ainda não confirmou
  const confirmandoLocal = pathname === "/acesso" || pathname === "/api/acesso";
  if (exige.locais && !confirmandoLocal && !(await validPlaceCookie(request.cookies.get(LOCAL_COOKIE)?.value, session))) {
    if (isApi) return NextResponse.json({ error: "Confirme a sua localização." }, { status: 401 });
    const volta = pathname + request.nextUrl.search;
    return NextResponse.redirect(new URL(`/acesso?${new URLSearchParams({ volta })}`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Arquivos públicos do PWA (manifest, service worker, ícones, página offline) e o guia de uso ficam fora da barreira
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|offline.html|icons/|ajuda|sessao-expirada).*)",
  ],
};

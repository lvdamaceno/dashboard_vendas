import { NextResponse, type NextRequest } from "next/server";
import { CLEAR_LOCAL_COOKIE, LOCAL_COOKIE, requirements, scheduleBlock, validPlaceCookie } from "@/lib/acesso";
import { ADMIN_HINT_COOKIE, CLEAR_SESSION_COOKIE, decryptSession, SESSION_COOKIE } from "@/lib/session";
import { stillActive } from "@/lib/session-check";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Segue para a página com a CSP desta requisição: só roda script com o nonce gerado aqui
 * (o Next aplica o nonce nos próprios scripts ao renderizar). Os estilos continuam com
 * 'unsafe-inline' porque os gráficos usam o atributo style, que nonce não cobre.
 */
function pass(request: NextRequest, rewrite?: URL) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    // Service worker (sw.js): com 'strict-dynamic' o 'self' do script-src não vale para ele
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  const res = rewrite ? NextResponse.rewrite(rewrite, { request: { headers } }) : NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

// Barreira inicial: sem sessão válida, nada além do login é acessível.
// As páginas revalidam a sessão por conta própria (defesa em profundidade).
export async function proxy(request: NextRequest) {
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/dashboard", request.url)) : pass(request);
  }
  // Login de admin fica aberto mesmo com sessão de vendedor (entrar como admin troca a sessão)
  if (pathname === "/admin/login") {
    return session?.role === "admin" ? NextResponse.redirect(new URL("/admin", request.url)) : pass(request);
  }
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  // /admin sem sessão de admin mostra o login de admin no próprio endereço (entrar troca a sessão)
  if (isAdminArea && session?.role !== "admin") return pass(request, new URL("/admin/login", request.url));
  if (!session) {
    // Último acesso deste aparelho foi de admin: volta para o login de admin
    const res = NextResponse.redirect(new URL(request.cookies.get(ADMIN_HINT_COOKIE) ? "/admin" : "/login", request.url));
    res.cookies.set(CLEAR_SESSION_COOKIE);
    return res;
  }

  const isApi = pathname.startsWith("/api/");
  // Master excluído pelo admin, funcionário demitido ou vendedor inativado no Sankhya: a sessão acaba
  if (!(await stillActive(session))) {
    console.info(`[login] ${session.apelido} (${session.role}) desconectado: não tem mais acesso ao painel`);
    const res = isApi
      ? NextResponse.json({ error: "Seu acesso ao painel foi encerrado." }, { status: 401 })
      : NextResponse.redirect(new URL("/login?fora=acesso", request.url));
    res.cookies.set(CLEAR_SESSION_COOKIE);
    res.cookies.set(CLEAR_LOCAL_COOKIE);
    return res;
  }

  // Horário e local permitidos para o grupo (aba "Horário e local" do admin)
  const exige = await requirements(session.role);
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
  return pass(request);
}

export const config = {
  // Arquivos públicos do PWA (manifest, service worker, ícones, página offline) e o guia de uso ficam fora da barreira
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|offline.html|icons/|ajuda|sessao-expirada).*)",
  ],
};

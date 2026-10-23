import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

// Barreira inicial: sem sessão válida, nada além do login é acessível.
// As páginas revalidam a sessão por conta própria (defesa em profundidade).
export async function proxy(request: NextRequest) {
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
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  // Arquivos públicos do PWA (manifest, service worker, ícones, página offline) e o guia de uso ficam fora da barreira
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|offline.html|icons/|ajuda|sessao-expirada).*)",
  ],
};

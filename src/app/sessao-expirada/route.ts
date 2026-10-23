import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_HINT_COOKIE, CLEAR_SESSION_COOKIE } from "@/lib/session";

// Chamado quando a sessão acaba (Sankhya invalidou, master removido…): limpa o cookie e volta ao login
// (o de admin, se o último acesso deste aparelho foi de admin).
export function GET(request: NextRequest) {
  const admin = Boolean(request.cookies.get(ADMIN_HINT_COOKIE));
  const res = NextResponse.redirect(new URL(admin ? "/admin" : "/login?expirada=1", request.url));
  res.cookies.set(CLEAR_SESSION_COOKIE);
  return res;
}

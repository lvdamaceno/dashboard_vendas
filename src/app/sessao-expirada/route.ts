import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Chamado quando o Sankhya invalida a sessão: limpa o cookie e volta ao login.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?expirada=1", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

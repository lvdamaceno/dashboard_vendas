import Link from "next/link";
import { logout } from "@/app/actions";
import { stopViewAs } from "@/app/admin/actions";
import type { Notice } from "@/lib/painel";
import type { Session } from "@/lib/session";
import { FeedbackButton } from "./feedback-button";
import { Logo } from "./logo";
import { NoticeBell } from "./notice-bell";

export const roleLabel = (s: Session, lojaNome?: string) => {
  const loja = lojaNome ?? `Loja ${s.codemp}`;
  if (s.role === "admin") return s.codemp ? `Admin · ${loja}` : "Admin · Todas as lojas";
  if (s.role === "master") return s.codemp ? `Diretoria · ${loja}` : "Diretoria · Todas as lojas";
  return s.role === "gerente" ? `Gerente · ${loja}` : `Vendedor · ${s.codvend}`;
};

interface Props {
  session: Session;
  /** Avisos do sino; null = não carregou (banco fora do ar) e o sino não aparece */
  notices?: Notice[] | null;
  stores?: { codigo: number; nome: string }[];
  /** Texto abaixo do nome (padrão: papel e loja) */
  scope?: string;
  /** Botão flutuante de sugestões e erros (desligado na área de admin) */
  feedback?: boolean;
  children: React.ReactNode;
}

export function Shell({ session, notices, stores = [], scope, feedback = true, children }: Props) {
  const como = session.role === "admin" ? session.como : undefined;
  const nomeLoja = (codemp: number) => stores.find((s) => s.codigo === codemp)?.nome;

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 bg-[#d71921] pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
          {notices && (
            <NoticeBell
              notices={notices}
              role={session.role}
              stores={stores}
              lojaNome={nomeLoja(session.codemp) ?? `Loja ${session.codemp}`}
            />
          )}
          <Logo variant="white" className="h-8 w-auto shrink-0 md:h-9" title="Casa Contente" />
          <div className="ml-auto min-w-0 text-right">
            <p className="truncate font-title text-sm font-medium">{session.apelido}</p>
            <p className="truncate text-xs text-white/80">{scope ?? roleLabel(session, nomeLoja(session.codemp))}</p>
          </div>
          {session.role === "admin" && (
            <Link
              href="/admin"
              className="flex h-10 shrink-0 items-center rounded-full bg-white/15 px-3 font-title text-sm font-medium hover:bg-white/25"
            >
              Admin
            </Link>
          )}
          <Link
            href="/ajuda"
            aria-label="Como usar o painel"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 font-title text-lg font-semibold hover:bg-white/25"
          >
            ?
          </Link>
          <form action={logout}>
            <button type="submit" className="h-10 rounded-full bg-white/15 px-4 font-title text-sm font-medium text-white hover:bg-white/25 active:bg-white/25">
              Sair
            </button>
          </form>
        </div>
      </header>
      {como && (
        <div className="bg-smile text-[#3c3c3a]">
          <form action={stopViewAs} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <p className="min-w-0 flex-1">
              Você está vendo o painel de <strong>{como.apelido}</strong> ({como.role === "master" ? "Diretoria" : roleLabel(como, nomeLoja(como.codemp))}).
            </p>
            <button type="submit" className="h-9 shrink-0 rounded-full bg-white/70 px-4 font-title font-medium hover:bg-white">
              Voltar ao admin
            </button>
          </form>
        </div>
      )}
      {/* pb-20: o fim da página não fica escondido atrás do botão flutuante */}
      <main className={`mx-auto max-w-6xl space-y-3 px-4 pt-4 md:space-y-4 md:pt-6 ${feedback ? "pb-20" : "pb-4 md:pb-6"}`}>{children}</main>
      {feedback && <FeedbackButton />}
    </div>
  );
}

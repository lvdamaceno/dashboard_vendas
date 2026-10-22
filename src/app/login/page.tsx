import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  const { expirada } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-6 h-14 w-auto" title="Casa Contente" />
          <h1 className="text-2xl">Painel de Vendas</h1>
          <p className="mt-1 text-sm text-ink-2">Entre com seu CPF</p>
        </div>
        {expirada && (
          <p className="mb-4 rounded-2xl border border-line bg-surface px-3 py-2 text-center text-sm text-ink-2">
            Sua sessão expirou. Entre novamente.
          </p>
        )}
        <LoginForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/ajuda" className="font-medium text-accent underline-offset-4 hover:underline">
            Primeira vez aqui? Veja como usar o painel
          </Link>
        </p>
      </div>
    </main>
  );
}

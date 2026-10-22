import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expirada?: string }> }) {
  const { expirada } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Painel de Vendas</h1>
          <p className="mt-1 text-sm text-ink-2">Entre com seu usuário e senha do Sankhya</p>
        </div>
        {expirada && (
          <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm text-ink-2">
            Sua sessão expirou. Entre novamente.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}

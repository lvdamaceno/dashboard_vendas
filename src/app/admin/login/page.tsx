import Link from "next/link";
import { Logo } from "@/components/logo";
import { AdminLoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-6 h-14 w-auto" title="Casa Contente" />
          <h1 className="text-2xl">Admin do painel</h1>
          <p className="mt-1 text-sm text-ink-2">Entre com usuário e senha. Se outra pessoa estiver conectada neste aparelho, ela sai.</p>
        </div>
        <AdminLoginForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Entrar com CPF
          </Link>
        </p>
      </div>
    </main>
  );
}

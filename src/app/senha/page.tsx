import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { listNotices } from "@/lib/painel";
import { getSession } from "@/lib/session";
import { PasswordForm } from "./password-form";

/** Diretoria (master): trocar a senha de acesso. */
export default async function PasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "master") redirect("/dashboard");
  const notices = await listNotices(session).catch(() => null);

  return (
    <Shell session={session} notices={notices}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl">Minha senha</h1>
        <Link href="/dashboard" className="h-10 rounded-full border border-line bg-surface px-4 font-title text-sm leading-10 font-medium text-ink-2 hover:bg-bg-alt">
          Voltar ao painel
        </Link>
      </div>
      <section className="max-w-md rounded-3xl border border-line bg-surface p-5">
        <PasswordForm />
      </section>
    </Shell>
  );
}

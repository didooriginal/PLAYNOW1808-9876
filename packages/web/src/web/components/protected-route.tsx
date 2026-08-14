import type { ReactNode } from "react";
import { Link, Redirect } from "wouter";
import { Loader2, ShieldAlert } from "lucide-react";
import { authClient } from "../lib/auth";
import { useEu } from "../queries/usuarios";
import { Logo } from "./logo";
import { GlassCard, NeonBackdrop, NeonButton } from "./ui/kit";

/** Tela neutra de espera — usada na checagem de sessão e no Suspense das rotas. */
export function Carregando({ texto = "Verificando sessão" }: { texto?: string }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <NeonBackdrop />
      <div className="relative flex flex-col items-center gap-5">
        <Logo size="sm" withTagline={false} />
        <span className="inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.22em] text-white/40">
          <Loader2 className="size-3.5 animate-spin" />
          {texto}
        </span>
      </div>
    </main>
  );
}

/** Rota que exige sessão — sem login, manda para /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <Carregando />;
  if (!session) return <Redirect to="/login" />;

  return <>{children}</>;
}

/** Rota do painel administrativo — exige sessão com a flag `usuarios.admin`. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const eu = useEu();

  if (isPending) return <Carregando />;
  if (!session) return <Redirect to="/login" />;
  if (eu.isPending) return <Carregando />;

  if (!eu.data?.admin) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6">
        <NeonBackdrop />
        <GlassCard strong accent="red" className="relative max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto size-7 text-neon-red" />
          <h1 className="mt-4 font-display text-lg font-bold text-white">Acesso restrito</h1>
          <p className="mt-2 font-sans text-sm leading-relaxed text-white/45">
            Esta área é exclusiva da administração da PLAYPLUSNOW. Sua conta está autenticada como
            cliente.
          </p>
          <Link to="/dashboard" className="mt-6 inline-block">
            <NeonButton accent="cyan" size="md">
              Ir para minha área
            </NeonButton>
          </Link>
        </GlassCard>
      </main>
    );
  }

  return <>{children}</>;
}

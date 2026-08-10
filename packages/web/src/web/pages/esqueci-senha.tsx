import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, KeyRound, MailCheck, TriangleAlert } from "lucide-react";
import { AuthField, AuthShell, inputClass } from "../components/auth-shell";
import { NeonButton } from "../components/ui/kit";
import { authClient } from "../lib/auth";

/**
 * "Esqueci minha senha" — 100% automático: o Better Auth gera um link de uso
 * único (validade de 1 hora) e o servidor dispara o e-mail na hora.
 * A resposta na tela é sempre a mesma, exista a conta ou não, para não
 * permitir descobrir quais e-mails são clientes.
 */
export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
    });
    setCarregando(false);
    if (error) {
      setErro(
        error.message ||
          "Não foi possível enviar agora. Tente de novo em alguns instantes.",
      );
      return;
    }
    setEnviado(true);
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Recuperar acesso"
      title={
        <>
          Esqueceu a senha?{" "}
          <span className="text-neon-cyan glow-cyan">a gente resolve</span>
        </>
      }
      subtitle="Informe o e-mail da sua conta. Mandamos na hora um link seguro para você criar uma senha nova — sem precisar falar com ninguém."
    >
      {enviado ? (
        <div
          className="space-y-5 text-center"
          data-testid="reset-enviado"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10">
            <MailCheck className="size-7 text-neon-cyan" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">
            Link enviado para {email.trim().toLowerCase()}
          </h2>
          <p className="font-sans text-sm leading-relaxed text-white/50">
            Se existir uma conta com esse e-mail, a mensagem chega em poucos
            minutos. O link vale por <strong className="text-white/80">1 hora</strong>{" "}
            e só pode ser usado uma vez.
          </p>
          <ul className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left">
            {[
              "Confira a caixa de spam / promoções.",
              "Não recebeu em 10 minutos? Peça o link de novo.",
              "Ainda travado? Chame o suporte no WhatsApp que a gente reenvia.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neon-cyan" />
                <span className="font-sans text-sm text-white/60">{t}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row">
            <NeonButton
              accent="cyan"
              size="lg"
              className="w-full"
              onClick={() => setEnviado(false)}
            >
              Enviar de novo
            </NeonButton>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-sans text-sm text-white/70 transition-colors hover:text-white"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={pedir} className="space-y-5">
          <AuthField
            label="E-mail da conta"
            hint="O mesmo que você usa para entrar no painel."
          >
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className={inputClass}
              data-testid="reset-email"
            />
          </AuthField>

          {erro && (
            <div className="flex items-start gap-2.5 rounded-xl border border-neon-red/35 bg-neon-red/10 px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-neon-red" />
              <span className="font-sans text-sm text-white/75">{erro}</span>
            </div>
          )}

          <NeonButton
            type="submit"
            accent="cyan"
            size="lg"
            className="w-full"
            disabled={carregando}
            data-testid="reset-enviar"
          >
            <KeyRound className="size-4" />
            {carregando ? "Enviando..." : "Enviar link de redefinição"}
          </NeonButton>

          <p className="text-center font-sans text-sm text-white/40">
            Lembrou a senha?{" "}
            <Link to="/login" className="font-semibold text-neon-cyan hover:underline">
              Voltar ao login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

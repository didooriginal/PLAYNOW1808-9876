import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { AuthField, AuthShell, inputClass } from "../components/auth-shell";
import { NeonButton } from "../components/ui/kit";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";

/** mensagens da API do Better Auth traduzidas */
function traduzErro(code?: string, message?: string) {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou senha incorretos.";
    case "USER_NOT_FOUND":
      return "Não encontramos uma conta com esse e-mail.";
    case "EMAIL_NOT_VERIFIED":
      return "Confirme seu e-mail antes de entrar.";
    default:
      return message || "Não foi possível entrar. Tente novamente.";
  }
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  /** veio do checkout: volta para o pagamento em vez do painel */
  const voltarParaCheckout = useMemo(() => {
    if (params.get("next") !== "checkout") return null;
    const p = new URLSearchParams(params);
    p.delete("next");
    const query = p.toString();
    return query ? `/checkout?${query}` : "/checkout";
  }, [params]);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) {
      setCarregando(false);
      setErro(traduzErro(error.code, error.message));
      return;
    }

    // administrador cai direto no painel de gestão; cliente na área de acessos
    let destino = voltarParaCheckout ?? "/dashboard";
    try {
      const eu = await client.usuarios.eu();
      if (eu.admin) destino = "/admin";
    } catch {
      /* sem perfil resolvido — segue para a área do cliente */
    }
    setCarregando(false);
    navigate(destino);
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Área do cliente"
      title={
        <>
          Seus acessos,{" "}
          <span className="text-neon-cyan glow-cyan">sempre à mão</span>
        </>
      }
      subtitle="Entre para ver as credenciais de cada streaming do seu pacote, pagar por Pix na hora e acompanhar a próxima cobrança."
    >
      <form onSubmit={entrar} className="space-y-5">
        <AuthField label="E-mail">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className={inputClass}
          />
        </AuthField>

        <AuthField label="Senha">
          <div className="relative">
            <input
              type={verSenha ? "text" : "password"}
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/35 transition-colors hover:text-white/70"
            >
              {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </AuthField>

        <div className="-mt-2 text-right">
          <Link
            to="/esqueci-senha"
            className="font-sans text-xs font-semibold text-neon-cyan/80 transition-colors hover:text-neon-cyan hover:underline"
            data-testid="link-esqueci-senha"
          >
            Esqueci minha senha
          </Link>
        </div>

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
        >
          <LogIn className="size-4" />
          {carregando ? "Entrando..." : "Entrar no painel"}
        </NeonButton>

        <p className="text-center font-sans text-sm text-white/40">
          Ainda não é cliente?{" "}
          <Link to="/signup" className="font-semibold text-neon-cyan hover:underline">
            Criar minha conta
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

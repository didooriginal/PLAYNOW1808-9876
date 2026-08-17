import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  CheckCircle2,
  LockKeyhole,
  TriangleAlert,
} from "lucide-react";
import { AuthField, AuthShell, inputClass } from "../components/auth-shell";
import { NeonButton } from "../components/ui/kit";
import { CampoSenha } from "../components/ui/campo-senha";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";

/** Regras mínimas de senha, checadas antes de bater no servidor. */
function validar(senha: string) {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(senha)) return "Inclua pelo menos uma letra.";
  if (!/[0-9]/.test(senha)) return "Inclua pelo menos um número.";
  return null;
}

function traduzErro(code?: string, message?: string) {
  switch (code) {
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "Este link expirou ou já foi usado. Peça um novo link de redefinição.";
    case "PASSWORD_TOO_SHORT":
      return "A senha precisa ter pelo menos 8 caracteres.";
    default:
      return message || "Não foi possível trocar a senha. Peça um link novo.";
  }
}

/**
 * Tela aberta pelo link do e-mail (`/redefinir-senha?token=...`).
 * Troca a senha pelo Better Auth e já entra na conta em seguida.
 */
export default function RedefinirSenhaPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const token = useMemo(
    () => new URLSearchParams(search).get("token") ?? "",
    [search],
  );

  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const problema = validar(senha);
    if (problema) return setErro(problema);
    if (senha !== confirma) return setErro("As duas senhas não são iguais.");

    setCarregando(true);
    const { error } = await authClient.resetPassword({
      newPassword: senha,
      token,
    });
    if (error) {
      setCarregando(false);
      setErro(traduzErro(error.code, error.message));
      return;
    }
    setPronto(true);
    setCarregando(false);
  }

  /** Entra com a senha nova e manda para o painel certo. */
  async function entrarAgora(emailInformado: string) {
    setCarregando(true);
    const { error } = await authClient.signIn.email({
      email: emailInformado.trim().toLowerCase(),
      password: senha,
    });
    if (error) {
      setCarregando(false);
      navigate("/login");
      return;
    }
    let destino = "/dashboard";
    try {
      const eu = await client.usuarios.eu();
      if (eu.admin) destino = "/admin";
    } catch {
      /* sem perfil resolvido — segue para a área do cliente */
    }
    setCarregando(false);
    navigate(destino);
  }

  if (!token) {
    return (
      <AuthShell
        accent="red"
        eyebrow="Recuperar acesso"
        title={<>Link inválido</>}
        subtitle="O endereço aberto não tem o código de redefinição. Isso costuma acontecer quando o link é copiado pela metade."
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-neon-red/35 bg-neon-red/10">
            <TriangleAlert className="size-7 text-neon-red" />
          </div>
          <p className="font-sans text-sm text-white/55">
            Peça um link novo — ele chega no seu e-mail em poucos minutos.
          </p>
          <Link
            to="/esqueci-senha"
            className="inline-flex w-full items-center justify-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-5 py-3 font-sans text-sm font-semibold text-neon-cyan"
          >
            Pedir novo link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Recuperar acesso"
      title={
        <>
          Crie sua{" "}
          <span className="text-neon-cyan glow-cyan">nova senha</span>
        </>
      }
      subtitle="Escolha uma senha com no mínimo 8 caracteres, misturando letras e números. Depois disso o link do e-mail deixa de funcionar."
    >
      {pronto ? (
        <SenhaTrocada carregando={carregando} onEntrar={entrarAgora} />
      ) : (
        <form onSubmit={trocar} className="space-y-5">
          <AuthField label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números.">
            <CampoSenha
              value={senha}
              onChange={setSenha}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              testId="nova-senha"
            />
          </AuthField>

          <AuthField label="Repita a nova senha">
            <CampoSenha
              value={confirma}
              onChange={setConfirma}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              testId="confirma-senha"
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
            data-testid="salvar-senha"
          >
            <LockKeyhole className="size-4" />
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </NeonButton>

          <p className="text-center font-sans text-sm text-white/40">
            Mudou de ideia?{" "}
            <Link to="/login" className="font-semibold text-neon-cyan hover:underline">
              Voltar ao login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

/** Confirmação + atalho para entrar já com a senha nova. */
function SenhaTrocada({
  carregando,
  onEntrar,
}: {
  carregando: boolean;
  onEntrar: (email: string) => void;
}) {
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-5" data-testid="senha-trocada">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-400/10">
        <CheckCircle2 className="size-7 text-emerald-400" />
      </div>
      <h2 className="text-center font-display text-xl font-bold text-white">
        Senha alterada
      </h2>
      <p className="text-center font-sans text-sm leading-relaxed text-white/50">
        Pronto. Já pode entrar com a senha nova — o link do e-mail não funciona
        mais.
      </p>

      <AuthField label="Seu e-mail" hint="Só para entrarmos direto no seu painel.">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className={inputClass}
        />
      </AuthField>

      <NeonButton
        accent="cyan"
        size="lg"
        className="w-full"
        disabled={carregando || !email.trim()}
        onClick={() => onEntrar(email)}
      >
        {carregando ? "Entrando..." : "Entrar agora"}
      </NeonButton>

      <p className="text-center font-sans text-sm text-white/40">
        Ou{" "}
        <Link to="/login" className="font-semibold text-neon-cyan hover:underline">
          ir para a tela de login
        </Link>
      </p>
    </div>
  );
}

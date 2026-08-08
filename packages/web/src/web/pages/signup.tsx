import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Check, Eye, EyeOff, MessageCircle, TriangleAlert, UserPlus } from "lucide-react";
import { AuthField, AuthShell, inputClass } from "../components/auth-shell";
import { AppIcon } from "../components/app-icon";
import { NeonButton, accentHex } from "../components/ui/kit";
import { brl, serviceById, whatsappLink, type ServiceId } from "@/lib/mock-data";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";
import { usePacotes } from "../queries/pacotes";
import { pacoteParaPlano } from "../queries/planos";

function traduzErro(code?: string, message?: string) {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_EMAIL_ALREADY_EXISTS":
      return "Já existe uma conta com esse e-mail. Faça login.";
    case "PASSWORD_TOO_SHORT":
      return "A senha precisa ter no mínimo 8 caracteres.";
    default:
      return message || "Não foi possível criar a conta. Tente novamente.";
  }
}

const slug = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function SignupPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const planoSlug = params.get("plano");
  const ciclo = params.get("ciclo") === "anual" ? "anual" : "mensal";
  // combo à la carte montado na calculadora da landing
  const comboIds = useMemo(() => {
    const raw = params.get("combo");
    if (!raw) return [] as ServiceId[];
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .filter((id) => {
        try {
          return Boolean(serviceById(id as ServiceId));
        } catch {
          return false;
        }
      }) as ServiceId[];
  }, [params]);
  const comboPreco = Number(params.get("preco") ?? 0);

  const { data: pacotes } = usePacotes();
  const pacote = useMemo(() => {
    const ativos = (pacotes ?? []).filter((p) => p.ativo);
    if (!planoSlug) return null;
    return ativos.find((p) => slug(p.nome) === planoSlug) ?? null;
  }, [pacotes, planoSlug]);

  const plano = pacote ? pacoteParaPlano(pacote) : null;
  const combo = comboIds.length ? comboIds : null;
  const valorMes = plano
    ? ciclo === "anual"
      ? plano.yearlyMonthly
      : plano.monthly
    : combo && Number.isFinite(comboPreco)
      ? comboPreco
      : 0;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    setCarregando(true);
    const { error } = await authClient.signUp.email({
      name: nome.trim(),
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (error) {
      setCarregando(false);
      setErro(traduzErro(error.code, error.message));
      return;
    }

    // grava o pacote escolhido no cadastro do cliente (pagamento segue no WhatsApp)
    try {
      await client.usuarios.escolherPacote({
        pacoteId: pacote?.id ?? null,
        ciclo,
        valor: valorMes,
        telefone: telefone.trim() || undefined,
      });
    } catch {
      /* conta criada — o pacote pode ser ajustado pelo atendimento */
    }

    setCarregando(false);

    const conta = email.trim().toLowerCase();
    const mensagem = plano
      ? `Olá! Acabei de criar minha conta na PLAPLUSNOW (${conta}) e quero finalizar a assinatura do pacote ${plano.name} — ${ciclo === "anual" ? "plano anual" : "plano mensal"}, ${brl(valorMes)}/mês.`
      : combo
        ? `Olá! Acabei de criar minha conta na PLAPLUSNOW (${conta}) e quero finalizar meu combo personalizado: ${combo
            .map((id) => serviceById(id).name)
            .join(", ")} — ${brl(valorMes)}/mês.`
        : `Olá! Acabei de criar minha conta na PLAPLUSNOW (${conta}) e quero finalizar minha assinatura.`;
    window.open(whatsappLink(mensagem), "_blank", "noopener,noreferrer");
    navigate("/dashboard");
  }

  const hex = accentHex[plano?.accent ?? "red"];

  return (
    <AuthShell
      accent="red"
      eyebrow={plano ? plano.name : combo ? "Combo personalizado" : "Criar conta"}
      title={
        <>
          Crie sua conta e{" "}
          <span className="text-neon-red glow-red">garanta sua vaga</span>
        </>
      }
      subtitle="Leva 30 segundos. Depois de cadastrar, você é levado ao WhatsApp para confirmar o pagamento e os acessos são liberados na sua área do cliente."
    >
      {plano && (
        <div
          className="mb-6 rounded-2xl border p-4"
          style={{ borderColor: `${hex}44`, background: `${hex}12` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
                Pacote escolhido
              </div>
              <div className="mt-1 font-display text-xl font-bold text-white">{plano.name}</div>
              <div className="mt-1 font-sans text-xs text-white/45">
                {ciclo === "anual" ? "Plano anual" : "Plano mensal"} · {plano.items.length} apps
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="font-sans text-[11px] text-white/40">R$</span>
                <span className="font-display text-2xl font-extrabold leading-none" style={{ color: hex }}>
                  {valorMes.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-white/35">
                por mês
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {plano.items.map((id) => (
              <AppIcon key={id} id={id} size="xs" active />
            ))}
          </div>
          <Link
            to="/#pacotes"
            className="mt-4 inline-flex items-center gap-1.5 font-sans text-[11px] text-white/40 underline-offset-4 hover:text-white hover:underline"
          >
            trocar de pacote
          </Link>
        </div>
      )}

      {!plano && combo && (
        <div className="mb-6 rounded-2xl border border-neon-red/40 bg-neon-red/[0.08] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
                Combo personalizado
              </div>
              <div className="mt-1 font-display text-xl font-bold text-white">
                {combo.length} apps escolhidos
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="font-sans text-[11px] text-white/40">R$</span>
                <span className="font-display text-2xl font-extrabold leading-none text-neon-red">
                  {valorMes.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="font-sans text-[10px] uppercase tracking-widest text-white/35">
                por mês
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {combo.map((id) => (
              <AppIcon key={id} id={id} size="xs" active />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={cadastrar} className="space-y-5">
        <AuthField label="Nome completo">
          <input
            type="text"
            required
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como podemos te chamar"
            className={inputClass}
          />
        </AuthField>

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

        <AuthField label="WhatsApp" hint="Usamos para confirmar o pagamento e enviar os acessos.">
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(21) 96472-7746"
            className={inputClass}
          />
        </AuthField>

        <AuthField label="Senha" hint="Mínimo de 8 caracteres.">
          <div className="relative">
            <input
              type={verSenha ? "text" : "password"}
              required
              autoComplete="new-password"
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

        {erro && (
          <div className="flex items-start gap-2.5 rounded-xl border border-neon-red/35 bg-neon-red/10 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-neon-red" />
            <span className="font-sans text-sm text-white/75">{erro}</span>
          </div>
        )}

        <NeonButton type="submit" accent="red" size="lg" className="w-full" disabled={carregando}>
          {carregando ? (
            <>
              <UserPlus className="size-4" />
              Criando conta...
            </>
          ) : (
            <>
              <MessageCircle className="size-4" />
              Criar conta e finalizar
            </>
          )}
        </NeonButton>

        <ul className="space-y-2">
          {["Sem cartão agora — pagamento confirmado no WhatsApp", "Cancele quando quiser, sem multa"].map(
            (t) => (
              <li key={t} className="flex items-start gap-2 font-sans text-[11px] text-white/35">
                <Check className="mt-0.5 size-3 shrink-0 text-neon-cyan" />
                {t}
              </li>
            ),
          )}
        </ul>

        <p className="text-center font-sans text-sm text-white/40">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-neon-cyan hover:underline">
            Entrar no painel
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

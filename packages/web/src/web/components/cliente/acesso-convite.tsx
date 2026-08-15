import { useState } from "react";
import { CheckCircle2, Clock, Mail, Send } from "lucide-react";
import { NeonButton } from "../ui/kit";
import { usePedirConvite } from "../../queries/planos-apps";

/**
 * ACESSO ENTREGUE POR CONVITE (ex.: Netflix "membro extra").
 *
 * Aqui não existe login compartilhado: o cliente informa o e-mail dele, o
 * admin cadastra esse e-mail no painel do provedor e o PRÓPRIO provedor manda
 * o convite. Este bloco cobre os quatro estados do pedido:
 *   sem-email → pendente → enviado → ativo   (ou recusado)
 */
export function AcessoConvite({
  servico,
  status,
  email,
  observacao,
}: {
  servico: string;
  status: string;
  email: string;
  observacao: string;
}) {
  const [valor, setValor] = useState(email);
  const [editando, setEditando] = useState(false);
  const pedir = usePedirConvite();

  const precisaEmail = status === "sem-email" || status === "recusado" || editando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const alvo = valor.trim();
    if (!alvo) return;
    await pedir.mutateAsync({ servico, email: alvo });
    setEditando(false);
  }

  if (precisaEmail) {
    return (
      <form
        onSubmit={enviar}
        className="relative mt-5 rounded-xl border border-neon-cyan/30 bg-neon-cyan/[0.06] p-4"
        data-testid="convite-form"
      >
        <div className="flex items-center gap-2 font-display text-xs font-bold text-neon-cyan">
          <Mail className="size-3.5" />
          Informe o seu e-mail
        </div>
        <p className="mt-1 font-sans text-[11px] leading-relaxed text-white/50">
          Este acesso é individual: cadastramos o seu e-mail no provedor e ele mesmo envia o convite
          para você criar o seu perfil com a sua senha.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={valor}
            onChange={(ev) => setValor(ev.target.value)}
            placeholder="seuemail@exemplo.com"
            aria-label="E-mail para receber o convite"
            className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-sans text-xs text-white placeholder:text-white/25 focus:border-neon-cyan/60 focus:outline-none"
          />
          <NeonButton accent="cyan" size="sm" type="submit" disabled={pedir.isPending}>
            <Send className="size-3.5 shrink-0" />
            {pedir.isPending ? "Enviando..." : "Enviar"}
          </NeonButton>
        </div>
        {pedir.isError && (
          <p className="mt-2 font-sans text-[11px] text-neon-red">
            {(pedir.error as Error)?.message || "Não consegui salvar o e-mail. Tente de novo."}
          </p>
        )}
        {status === "recusado" && observacao && (
          <p className="mt-2 font-sans text-[11px] text-amber-300">{observacao}</p>
        )}
      </form>
    );
  }

  const enviado = status === "enviado";
  const ativo = status === "ativo";

  return (
    <div
      className={`relative mt-5 rounded-xl border p-4 ${
        ativo
          ? "border-emerald-400/35 bg-emerald-400/[0.08]"
          : "border-amber-400/35 bg-amber-400/10"
      }`}
      data-testid="convite-status"
    >
      <div
        className={`flex items-center gap-2 font-display text-xs font-bold ${
          ativo ? "text-emerald-300" : "text-amber-200"
        }`}
      >
        {ativo ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
        {ativo
          ? "Convite aceito — acesso liberado"
          : enviado
            ? "Convite enviado pelo provedor"
            : "Aguardando cadastro"}
      </div>
      <p className="mt-1 font-sans text-[11px] leading-relaxed text-white/50">
        {ativo
          ? "Entre com o seu próprio e-mail e senha no aplicativo."
          : enviado
            ? "Procure o convite na caixa de entrada (e no spam) e aceite para criar a sua senha."
            : "Estamos cadastrando o seu e-mail no provedor. Assim que o convite sair, ele chega direto no seu e-mail."}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/30 px-3 py-2">
        <span className="min-w-0 truncate font-mono text-[11px] text-white/70">{email}</span>
        <button
          type="button"
          onClick={() => {
            setValor(email);
            setEditando(true);
          }}
          className="shrink-0 font-sans text-[11px] font-semibold text-neon-cyan hover:underline"
        >
          Trocar
        </button>
      </div>
      {observacao && <p className="mt-2 font-sans text-[11px] text-white/45">{observacao}</p>}
    </div>
  );
}

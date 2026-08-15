import { AlertTriangle, Check, Clock, Copy, Loader2, Mail, MessageCircle, X } from "lucide-react";
import { AppIcon } from "../app-icon";
import { Ajuda } from "../ui/tooltip";
import { GlassCard, Pill } from "../ui/kit";
import { useAtualizarConvite, useFilaConvites } from "../../queries/planos-apps";

/**
 * FILA DE CONVITES (membro extra).
 *
 * Algumas opções não são entregues por login e senha de conta matriz: o
 * cliente informa o e-mail dele e o admin o cadastra como membro extra no
 * painel do provedor — quem envia o acesso é o próprio provedor (é o caso da
 * Netflix individual). Esta tela é a fila desses cadastros manuais.
 *
 * O cliente vê o mesmo status no painel dele, então marcar "enviado" aqui é o
 * que tira o "aguardando cadastro" da tela dele.
 */

const STATUS: Record<
  string,
  { rotulo: string; cor: string; descricao: string }
> = {
  pendente: {
    rotulo: "Aguardando cadastro",
    cor: "#fbbf24",
    descricao: "Cadastre este e-mail como membro extra no painel do provedor.",
  },
  enviado: {
    rotulo: "Convite enviado",
    cor: "#22d3ee",
    descricao: "O provedor já mandou o convite. Aguardando o cliente aceitar.",
  },
  ativo: {
    rotulo: "Ativo",
    cor: "#34d399",
    descricao: "Cliente aceitou e está usando.",
  },
  recusado: {
    rotulo: "Recusado",
    cor: "#ff1f3d",
    descricao: "Não foi possível cadastrar — combine outro e-mail com o cliente.",
  },
};

const soDigitos = (v: string) => v.replace(/\D/g, "");

export function ConvitesView() {
  const { data, isPending, isError, error } = useFilaConvites();
  const atualizar = useAtualizarConvite();

  if (isError)
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <AlertTriangle className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Erro ao carregar a fila de convites
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">{error?.message}</p>
      </GlassCard>
    );

  if (isPending)
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="size-5 animate-spin text-white/30" />
      </div>
    );

  const fila = data ?? [];
  const pendentes = fila.filter((c) => c.status === "pendente");

  if (fila.length === 0)
    return (
      <GlassCard className="p-10 text-center">
        <Mail className="mx-auto size-6 text-white/25" />
        <p className="mt-3 font-display text-sm font-bold text-white">Nenhum convite na fila</p>
        <p className="mx-auto mt-1.5 max-w-md font-sans text-xs leading-relaxed text-white/40">
          Quando um cliente contratar uma opção entregue por convite — como a Netflix
          individual — o pedido aparece aqui com o e-mail dele para você cadastrar no
          painel do provedor.
        </p>
      </GlassCard>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill accent={pendentes.length ? "red" : "cyan"} icon={<Clock className="size-3" />}>
          {pendentes.length} aguardando cadastro
        </Pill>
        <Ajuda ajuda="secao.convites" />
      </div>

      <ul className="space-y-3">
        {fila.map((c) => {
          const st = STATUS[c.status] ?? STATUS.pendente;
          const zap = soDigitos(c.whatsapp || "");
          return (
            <li key={c.id}>
              <GlassCard className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <AppIcon id={c.servico} size="sm" active />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold text-white">
                      {c.cliente}
                    </div>
                    <div className="font-mono text-[11px] text-white/35">{c.servico}</div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold"
                    style={{ color: st.cor, background: `${st.cor}18` }}
                  >
                    {st.rotulo}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <Mail className="size-3.5 shrink-0 text-white/30" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                    {c.email}
                  </span>
                  <button
                    type="button"
                    aria-label="Copiar e-mail do cliente"
                    onClick={() => navigator.clipboard?.writeText(c.email)}
                    className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
                  >
                    <Copy className="size-3" />
                  </button>
                  {zap && (
                    <a
                      href={`https://wa.me/55${zap}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Falar com o cliente no WhatsApp"
                      className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-emerald-400/50 hover:text-emerald-400"
                    >
                      <MessageCircle className="size-3" />
                    </a>
                  )}
                </div>

                <p className="mt-2 font-sans text-[11px] text-white/40">{st.descricao}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status !== "enviado" && (
                    <button
                      type="button"
                      aria-label="Marcar convite como enviado"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ id: c.id, status: "enviado" })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/40 px-3 py-1.5 font-sans text-[11px] text-neon-cyan transition-colors hover:bg-neon-cyan/10"
                    >
                      <Mail className="size-3" />
                      Convite enviado
                    </button>
                  )}
                  {c.status !== "ativo" && (
                    <button
                      type="button"
                      aria-label="Marcar cliente como ativo"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ id: c.id, status: "ativo" })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 px-3 py-1.5 font-sans text-[11px] text-emerald-400 transition-colors hover:bg-emerald-400/10"
                    >
                      <Check className="size-3" />
                      Aceitou / está ativo
                    </button>
                  )}
                  {c.status !== "recusado" && (
                    <button
                      type="button"
                      aria-label="Marcar convite como recusado"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ id: c.id, status: "recusado" })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 font-sans text-[11px] text-white/45 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                    >
                      <X className="size-3" />
                      Não deu certo
                    </button>
                  )}
                </div>
              </GlassCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

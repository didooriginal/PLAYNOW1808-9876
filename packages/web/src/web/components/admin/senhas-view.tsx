import { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MailWarning,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useDescartarResetSenha,
  useFilaSenha,
  useGerarLinkSenha,
} from "../../queries/senha";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

function dataHora(d: Date | string | null) {
  if (!d) return "—";
  const data = typeof d === "string" ? new Date(d) : d;
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rotuloEntrega: Record<string, { texto: string; cor: string }> = {
  enviado: { texto: "E-mail enviado", cor: "text-emerald-400" },
  pendente: { texto: "Não enviado", cor: "text-white/45" },
  falhou: { texto: "Falha no envio", cor: "text-neon-red" },
  sem_provedor: { texto: "Sem provedor de e-mail", cor: "text-amber-400" },
};

const rotuloSituacao: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: "Aguardando o cliente", cor: "text-neon-cyan" },
  usado: { texto: "Senha trocada", cor: "text-emerald-400" },
  expirado: { texto: "Expirado", cor: "text-white/40" },
};

/** Botão de copiar com confirmação visual. */
function BotaoCopiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  if (!texto) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-sans text-[11px] text-white/60 transition-colors hover:text-white"
    >
      {ok ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      {ok ? "copiado" : "copiar link"}
    </button>
  );
}

/**
 * SENHAS & ACESSO
 *
 * O fluxo do cliente é automático (ele pede em /esqueci-senha e recebe o link
 * por e-mail). Esta tela existe para os casos de exceção: cliente que não
 * recebe o e-mail, ou enquanto o domínio de envio não está verificado — o
 * admin gera o link aqui e manda pelo WhatsApp.
 */
export function SenhasView() {
  const fila = useFilaSenha();
  const gerar = useGerarLinkSenha();
  const descartar = useDescartarResetSenha();
  const [email, setEmail] = useState("");
  const [resultado, setResultado] = useState<{
    ok: boolean;
    motivo: string;
    link: string;
  } | null>(null);

  const itens = fila.data?.itens ?? [];

  return (
    <div className="space-y-5">
      {/* ------- estado do canal de e-mail ------- */}
      {fila.data && !fila.data.emailAtivo && (
        <GlassCard className="border-amber-400/25 bg-amber-400/[0.06] p-5">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-display text-sm font-bold text-white">
                Envio automático de e-mail desligado
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-white/55">
                Falta a chave <span className="font-mono">RESEND_API_KEY</span> no
                servidor. Os pedidos continuam entrando nesta fila: gere o link
                aqui e mande para o cliente pelo WhatsApp. Assim que a chave for
                configurada, o e-mail passa a sair sozinho.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ------- e-mail ativo, mas com entregas recusadas ------- */}
      {fila.data?.emailAtivo && (fila.data?.falhas ?? 0) > 0 && (
        <GlassCard className="border-amber-400/25 bg-amber-400/[0.06] p-5">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-display text-sm font-bold text-white">
                E-mail ativo, mas algumas entregas foram recusadas
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-white/55">
                Isso acontece enquanto o domínio de envio não está verificado: o
                provedor só aceita entregar no e-mail dono da conta. Até
                verificar o domínio, use o botão de copiar link abaixo e mande
                para o cliente pelo WhatsApp. O motivo exato de cada recusa
                aparece em vermelho no item.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ------- gerar link manualmente ------- */}
      <GlassCard strong accent="purple" className="p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-neon-purple" />
          <span className="font-display text-sm font-bold text-white">
            Resetar senha de um cliente
          </span>
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          Gera um link de uso único (validade de 1 hora) e tenta enviar por
          e-mail. Você nunca vê nem define a senha do cliente — quem escolhe a
          nova senha é ele.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@docliente.com"
            className={inputCls}
            data-testid="admin-reset-email"
          />
          <NeonButton
            accent="purple"
            disabled={gerar.isPending || !email.trim()}
            onClick={async () => {
              setResultado(null);
              const r = await gerar.mutateAsync({ email: email.trim().toLowerCase() });
              setResultado({ ok: r.ok, motivo: r.motivo, link: r.link });
            }}
            data-testid="admin-reset-gerar"
          >
            {gerar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Gerar link
          </NeonButton>
        </div>

        {resultado && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 ${
              resultado.ok
                ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                : "border-neon-red/30 bg-neon-red/[0.07]"
            }`}
          >
            {resultado.ok ? (
              <>
                <p className="font-sans text-xs text-white/70">
                  Link gerado. Se o e-mail não sair, copie e mande pelo WhatsApp:
                </p>
                <p className="mt-2 break-all font-mono text-[11px] text-neon-cyan">
                  {resultado.link}
                </p>
                <div className="mt-2.5">
                  <BotaoCopiar texto={resultado.link} />
                </div>
              </>
            ) : (
              <p className="font-sans text-xs text-white/70">{resultado.motivo}</p>
            )}
          </div>
        )}
      </GlassCard>

      {/* ------- fila de pedidos ------- */}
      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">
              Pedidos de redefinição
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Pill accent="cyan">{fila.data?.pendentes ?? 0} aguardando</Pill>
            {(fila.data?.falhas ?? 0) > 0 && (
              <Pill accent="red">{fila.data?.falhas} sem entrega</Pill>
            )}
          </div>
        </div>

        {fila.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 font-sans text-sm text-white/40">
            <Loader2 className="size-4 animate-spin" /> carregando...
          </div>
        ) : itens.length === 0 ? (
          <p className="px-5 py-8 font-sans text-sm text-white/40">
            Nenhum pedido de redefinição até agora.
          </p>
        ) : (
          <div className="divide-y divide-white/6">
            {itens.map((item) => {
              const entrega = rotuloEntrega[item.entrega] ?? rotuloEntrega.pendente;
              const situacao =
                rotuloSituacao[item.situacao] ?? rotuloSituacao.expirado;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-semibold text-white">
                      {item.nome || item.email}
                    </p>
                    <p className="truncate font-mono text-[11px] text-white/45">
                      {item.email}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px]">
                      <span className={situacao.cor}>{situacao.texto}</span>
                      <span className={entrega.cor}>{entrega.texto}</span>
                      <span className="inline-flex items-center gap-1 text-white/35">
                        <Timer className="size-3" />
                        pedido {dataHora(item.criadoEm)} · vale até{" "}
                        {dataHora(item.expiraEm)}
                      </span>
                      {item.origem === "admin" && (
                        <span className="text-white/35">gerado pelo admin</span>
                      )}
                    </div>
                    {item.erroEntrega && (
                      <p className="mt-1 font-sans text-[11px] text-neon-red/80">
                        {item.erroEntrega}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.situacao === "pendente" && (
                      <>
                        <BotaoCopiar texto={item.link} />
                        <button
                          type="button"
                          onClick={() => descartar.mutate({ id: item.id })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-sans text-[11px] text-white/50 transition-colors hover:border-neon-red/40 hover:text-neon-red"
                        >
                          <Trash2 className="size-3" />
                          invalidar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

import { CheckCircle2, CreditCard, QrCode, RefreshCw, TriangleAlert, X } from "lucide-react";
import { GlassCard, Pill } from "../ui/kit";
import { Ajuda, Tooltip } from "../ui/tooltip";
import { useCancelarPix, useCobrancasPix, useConfirmarPix } from "../../queries/pix";
import { useAssinaturasAdmin } from "../../queries/assinaturas";

/**
 * PAGAMENTOS (admin) — Pix e assinaturas no cartão, ambos no Mercado Pago.
 *
 * A baixa é automática: o webhook `/api/webhooks/mercadopago` confirma e o
 * painel do cliente libera na hora. O botão "Dar baixa" fica como plano B
 * para pagamento fora do gateway (dinheiro, transferência) — é a mesma
 * função de baixa do webhook, então não existe caminho divergente.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

const ROTULO_ASSINATURA: Record<string, string> = {
  pending: "aguardando cartão",
  authorized: "ativa",
  paused: "pausada",
  cancelled: "cancelada",
};

export function PixView() {
  const { data: pix } = useCobrancasPix();
  const { data: assinaturas } = useAssinaturasAdmin();
  const confirmar = useConfirmarPix();
  const cancelar = useCancelarPix();

  const ambiente = pix?.ambiente ?? "ausente";

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">Cobranças Pix</span>
            <Ajuda ajuda="pix.cobrancas" lado="bottom" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill accent="purple">provedor: {pix?.provedor ?? "mercadopago"}</Pill>
            <Tooltip texto="pix.ambiente">
              <span>
                <Pill accent={ambiente === "producao" ? "cyan" : "red"}>
                  {ambiente === "producao"
                    ? "produção — dinheiro real"
                    : ambiente === "teste"
                      ? "credencial de TESTE"
                      : "credencial ausente"}
                </Pill>
              </span>
            </Tooltip>
          </div>
        </div>

        <p className="mt-2 font-sans text-xs text-white/40">
          O cliente gera o Pix sozinho no painel e o Mercado Pago confirma pelo webhook — a
          liberação é automática. Use "Dar baixa" apenas para pagamento recebido fora do
          gateway.
        </p>

        {pix?.urlWebhook && (
          <p className="mt-1 font-mono text-[10px] text-white/25">webhook: {pix.urlWebhook}</p>
        )}

        {pix && !pix.dominioPublico && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-neon-red/30 bg-neon-red/[0.07] px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-neon-red" />
            <p className="font-sans text-[11.5px] leading-relaxed text-white/65">
              <span className="font-semibold text-white">Domínio público não configurado.</span>{" "}
              Defina <span className="font-mono text-[10.5px]">MERCADOPAGO_SITE_URL</span> com o
              endereço https do site. Sem isso o Mercado Pago não consegue chamar o webhook (a
              baixa fica dependendo da reconferência) e a assinatura no cartão é recusada.
              <Ajuda ajuda="pix.dominio" lado="top" className="ml-1 inline-flex" />
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {(pix?.cobrancas ?? []).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {c.cliente}
                </div>
                <div className="truncate font-mono text-[10px] text-white/30">{c.txid}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold text-white/80">
                  {brl(c.valor)}
                </span>
                <Pill
                  accent={c.status === "pago" ? "cyan" : c.status === "aguardando" ? "purple" : "red"}
                >
                  {c.status}
                </Pill>
                {c.status === "aguardando" && (
                  <>
                    <Tooltip texto="pix.baixaManual">
                      <button
                        type="button"
                        aria-label="Dar baixa manual nesta cobrança"
                        onClick={() => confirmar.mutate({ txid: c.txid })}
                        className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 font-sans text-[11px] text-emerald-300 hover:bg-emerald-400/20"
                      >
                        <CheckCircle2 className="mr-1 inline size-3" />
                        Dar baixa
                      </button>
                    </Tooltip>
                    <Tooltip texto="pix.cancelarCobranca">
                      <button
                        type="button"
                        aria-label="Cancelar esta cobrança"
                        onClick={() => cancelar.mutate({ txid: c.txid })}
                        className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/50 hover:bg-white/5"
                      >
                        <X className="mr-1 inline size-3" />
                        Cancelar
                      </button>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          ))}
          {!pix?.cobrancas.length && (
            <p className="font-sans text-xs text-white/35">
              Nenhuma cobrança gerada ainda. Elas aparecem assim que um cliente pedir o Pix no
              painel.
            </p>
          )}
        </div>
      </GlassCard>

      {/* ---------------- assinaturas no cartão ---------------- */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-neon-purple" />
            <span className="font-display text-sm font-bold text-white">
              Assinaturas no cartão
            </span>
            <Ajuda ajuda="pix.assinaturas" lado="bottom" />
          </div>
          <Pill accent="purple">
            {(assinaturas ?? []).filter((a) => a.status === "authorized").length} ativas
          </Pill>
        </div>

        <p className="mt-2 font-sans text-xs text-white/40">
          Cobrança recorrente automática do Mercado Pago. Cada renovação aprovada entra como
          pagamento e empurra o vencimento do cliente sozinha.
        </p>

        <div className="mt-4 space-y-2">
          {(assinaturas ?? []).map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {a.cliente}
                </div>
                <div className="truncate font-sans text-[11px] text-white/35">
                  {a.titulo} · {a.ciclo} · {a.cobrancasPagas} cobrança(s) paga(s) · último{" "}
                  {data(a.ultimoPagamentoEm)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold text-white/80">
                  {brl(a.valor)}
                </span>
                <Pill
                  accent={
                    a.status === "authorized" ? "cyan" : a.status === "pending" ? "purple" : "red"
                  }
                >
                  {ROTULO_ASSINATURA[a.status] ?? a.status}
                </Pill>
                {a.status === "authorized" && (
                  <Tooltip texto="pix.recorrenciaAtiva">
                    <span
                      aria-label="Recorrência ativa no cartão"
                      className="inline-flex items-center text-neon-cyan"
                    >
                      <RefreshCw className="size-3.5" />
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
          {!assinaturas?.length && (
            <p className="font-sans text-xs text-white/35">
              Nenhuma assinatura no cartão ainda. Elas aparecem quando um cliente escolhe
              "Cartão de crédito" no checkout.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default PixView;

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { useConsultarPix, useGerarCobrancaPix } from "../../queries/pix";
import { orpc } from "../../lib/api";

/**
 * PAGAR COM PIX (cliente).
 * Gera o copia-e-cola na hora e fica consultando o status. Quando o gateway
 * confirma (ou o admin dá baixa), a tela troca sozinha para "pago" e o acesso
 * volta sem ninguém precisar mandar print no WhatsApp.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PagarPix({
  faturaId,
  titulo,
}: { faturaId?: number; titulo?: string } = {}) {
  const gerar = useGerarCobrancaPix();
  const [txid, setTxid] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const status = useConsultarPix(txid);

  useEffect(() => {
    if (gerar.data?.txid) setTxid(gerar.data.txid);
  }, [gerar.data?.txid]);

  const pago = status.data?.status === "pago";

  // quando a baixa cai, o resto do painel (fatura, plano, jornada) precisa
  // recarregar — senão o cliente continua vendo "fatura em aberto"
  const qc = useQueryClient();
  const jaAtualizou = useRef(false);
  useEffect(() => {
    if (!pago || jaAtualizou.current) return;
    jaAtualizou.current = true;
    void qc.invalidateQueries({ queryKey: orpc.faturas.key() });
    void qc.invalidateQueries({ queryKey: orpc.usuarios.key() });
    void qc.invalidateQueries({ queryKey: orpc.recompensas.key() });
  }, [pago, qc]);

  return (
    <div id="pagar-pix" className="scroll-mt-24">
      <GlassCard strong accent={pago ? "cyan" : "purple"} className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="size-4 text-neon-purple" />
            <span className="font-display text-sm font-bold text-white">
              Pagar com Pix
            </span>
          </div>
          {pago && (
            <Pill accent="cyan" icon={<ShieldCheck className="size-3" />}>
              Pagamento confirmado
            </Pill>
          )}
        </div>

        <p className="mt-1.5 font-sans text-xs text-white/40">
          Gere o código, pague no app do banco e pronto: a baixa é automática e
          o acesso continua liberado sem mandar comprovante para ninguém.
        </p>

        {!gerar.data && (
          <NeonButton
            accent="purple"
            className="mt-4"
            disabled={gerar.isPending}
            onClick={() => gerar.mutate(faturaId ? { faturaId } : {})}
          >
            {gerar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <QrCode className="size-4" />
            )}
            {titulo ? `Gerar Pix · ${titulo}` : "Gerar Pix da fatura"}
          </NeonButton>
        )}

        {gerar.isError && (
          <p className="mt-3 font-sans text-xs text-neon-red">
            {gerar.error?.message}
          </p>
        )}

        {gerar.data && (
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-2xl font-extrabold text-white">
                {brl(gerar.data.valor)}
              </span>
              <span className="font-sans text-[11px] text-white/35">
                {pago
                  ? "confirmado"
                  : `expira em ${new Date(gerar.data.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>

            {gerar.data.qrBase64 && !pago && (
              <img
                src={`data:image/png;base64,${gerar.data.qrBase64}`}
                alt="QR Code do Pix"
                className="mx-auto mt-3 size-44 rounded-xl border border-white/10 bg-white p-2"
              />
            )}

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">
                Pix copia e cola
              </div>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-white/70">
                {gerar.data.copiaECola}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  gerar.data?.copiaECola ?? "",
                );
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1800);
              }}
              className="mt-3 w-full rounded-xl border border-neon-purple/40 bg-neon-purple/10 px-3 py-2.5 font-sans text-xs font-semibold text-neon-purple hover:bg-neon-purple/20"
            >
              {copiado ? (
                <Check className="mr-1 inline size-3.5" />
              ) : (
                <Copy className="mr-1 inline size-3.5" />
              )}
              {copiado ? "Código copiado" : "Copiar código Pix"}
            </button>

            {gerar.data.linkPagamento && !pago && (
              <a
                href={gerar.data.linkPagamento}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-center font-sans text-[11px] text-white/40 underline-offset-2 hover:text-neon-purple hover:underline"
              >
                abrir a página de pagamento do Mercado Pago
              </a>
            )}

            <p className="mt-3 font-sans text-[11px] text-white/30">
              {pago
                ? "Recebemos seu pagamento. Obrigado!"
                : "Assim que o pagamento cair, esta tela atualiza sozinha."}
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default PagarPix;

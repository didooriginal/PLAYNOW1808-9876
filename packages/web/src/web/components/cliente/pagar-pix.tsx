import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { CobrancaPixCard } from "./cobranca-pix";
import { useConsultarPix, useGerarCobrancaPix } from "../../queries/pix";

/**
 * PAGAR COM PIX (cliente) — cobrança da fatura em aberto.
 * Gera o copia-e-cola na hora; o acompanhamento do status, o QR e a
 * atualização do painel quando a baixa cai ficam no `CobrancaPixCard`, que a
 * área de renovação/antecipação também usa.
 */

export function PagarPix({
  faturaId,
  titulo,
}: { faturaId?: number; titulo?: string } = {}) {
  const gerar = useGerarCobrancaPix();
  const status = useConsultarPix(gerar.data?.txid ?? null);
  const pago = status.data?.status === "pago";

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
          <CobrancaPixCard key={gerar.data.txid} cobranca={gerar.data} accent="purple" />
        )}
      </GlassCard>
    </div>
  );
}

export default PagarPix;

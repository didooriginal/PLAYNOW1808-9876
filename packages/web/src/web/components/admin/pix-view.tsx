import { CheckCircle2, QrCode, X } from "lucide-react";
import { GlassCard, Pill } from "../ui/kit";
import { useCancelarPix, useCobrancasPix, useConfirmarPix } from "../../queries/pix";

/**
 * COBRANÇAS PIX (admin).
 * No modo `simulado` o BR Code é gerado a partir da chave em PIX_CHAVE e a
 * baixa é manual. Ao plugar um provedor real, o webhook /api/webhooks/pix dá
 * baixa sozinho e esta tela vira só conferência.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PixView() {
  const { data } = useCobrancasPix();
  const confirmar = useConfirmarPix();
  const cancelar = useCancelarPix();

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">Cobranças Pix</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill accent="purple">provedor: {data?.provedor ?? "simulado"}</Pill>
          <Pill accent={data?.chaveConfigurada ? "cyan" : "red"}>
            {data?.chaveConfigurada ? "chave Pix configurada" : "defina PIX_CHAVE no .env"}
          </Pill>
        </div>
      </div>

      <p className="mt-2 font-sans text-xs text-white/40">
        O cliente gera o Pix sozinho no painel. Com provedor real plugado, a baixa é automática
        pelo webhook; no modo simulado, confirme aqui e o acesso é liberado na hora.
      </p>

      <div className="mt-4 space-y-2">
        {(data?.cobrancas ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold text-white">{c.cliente}</div>
              <div className="truncate font-mono text-[10px] text-white/30">{c.txid}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-bold text-white/80">{brl(c.valor)}</span>
              <Pill accent={c.status === "pago" ? "cyan" : c.status === "aguardando" ? "purple" : "red"}>
                {c.status}
              </Pill>
              {c.status === "aguardando" && (
                <>
                  <button
                    type="button"
                    onClick={() => confirmar.mutate({ txid: c.txid })}
                    className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 font-sans text-[11px] text-emerald-300 hover:bg-emerald-400/20"
                  >
                    <CheckCircle2 className="mr-1 inline size-3" />
                    Dar baixa
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelar.mutate({ txid: c.txid })}
                    className="rounded-lg border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/50 hover:bg-white/5"
                  >
                    <X className="mr-1 inline size-3" />
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!data?.cobrancas.length && (
          <p className="font-sans text-xs text-white/35">
            Nenhuma cobrança gerada ainda. Elas aparecem assim que um cliente pedir o Pix no painel.
          </p>
        )}
      </div>
    </GlassCard>
  );
}

export default PixView;

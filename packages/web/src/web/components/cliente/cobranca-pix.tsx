import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsultarPix } from "../../queries/pix";
import { orpc } from "../../lib/api";

/**
 * COBRANÇA PIX GERADA — bloco visual reaproveitado.
 *
 * Recebe uma cobrança já criada no servidor (fatura, renovação em outro ciclo
 * ou antecipação — todas devolvem o mesmo formato) e cuida do resto: mostra QR,
 * copia-e-cola, fica consultando o status e, quando a baixa cai, invalida o
 * painel para o cliente ver o acesso liberado sem recarregar a página.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type CobrancaGerada = {
  txid: string;
  valor: number;
  copiaECola: string;
  qrBase64?: string | null;
  linkPagamento?: string | null;
  expiraEm: string;
};

export function CobrancaPixCard({
  cobranca,
  accent = "purple",
}: {
  cobranca: CobrancaGerada;
  accent?: "purple" | "cyan" | "red";
}) {
  const [copiado, setCopiado] = useState(false);
  const status = useConsultarPix(cobranca.txid);
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
    void qc.invalidateQueries({ queryKey: orpc.renovacao.key() });
  }, [pago, qc]);

  // classes completas (Tailwind não compila nome de classe montado em runtime)
  const BOTAO = {
    purple:
      "border-neon-purple/40 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20",
    cyan: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20",
    red: "border-neon-red/40 bg-neon-red/10 text-neon-red hover:bg-neon-red/20",
  } as const;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-2xl font-extrabold text-white">
          {brl(cobranca.valor)}
        </span>
        <span className="font-sans text-[11px] text-white/35">
          {pago
            ? "confirmado"
            : `expira em ${new Date(cobranca.expiraEm).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
        </span>
      </div>

      {cobranca.qrBase64 && !pago && (
        <img
          src={`data:image/png;base64,${cobranca.qrBase64}`}
          alt="QR Code do Pix"
          className="mx-auto mt-3 size-44 rounded-xl border border-white/10 bg-white p-2"
        />
      )}

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">
          Pix copia e cola
        </div>
        <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-white/70">
          {cobranca.copiaECola}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(cobranca.copiaECola);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        }}
        className={cn(
          "mt-3 w-full rounded-xl border px-3 py-2.5 font-sans text-xs font-semibold",
          BOTAO[accent],
        )}
      >
        {copiado ? (
          <Check className="mr-1 inline size-3.5" />
        ) : (
          <Copy className="mr-1 inline size-3.5" />
        )}
        {copiado ? "Código copiado" : "Copiar código Pix"}
      </button>

      {cobranca.linkPagamento && !pago && (
        <a
          href={cobranca.linkPagamento}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center font-sans text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
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
  );
}

export default CobrancaPixCard;

import { Clock, ArrowRight } from "lucide-react";
import { GlassCard } from "../ui/kit";
import { brl, type ServiceId } from "@/lib/mock-data";
import { AppIcon } from "../app-icon";

/**
 * APPS AGUARDANDO PAGAMENTO
 * ------------------------------------------------------------------
 * O admin pode adicionar um app "para liberar depois do pagamento". Nesse
 * caso o direito existe mas não vale ainda: ele não ocupa vaga e não aparece
 * em "Meus Acessos". Sem este bloco o cliente ficaria no escuro — pagaria uma
 * fatura maior sem entender o motivo, ou cobraria o suporte por um app que
 * "sumiu". Aqui ele vê o que falta pagar e que a liberação é automática.
 */
export function AppsAguardandoPagamento({
  itens,
  onPagar,
}: {
  itens: { servico: string; nome: string; appSlug: string; valor: number; aPagar: number }[];
  onPagar: () => void;
}) {
  if (itens.length === 0) return null;

  const total = Math.round(itens.reduce((s, i) => s + (i.aPagar || i.valor), 0) * 100) / 100;

  return (
    <GlassCard className="border-neon-purple/25 p-5">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-neon-purple" />
        <h3 className="font-display text-sm font-bold text-white">
          {itens.length === 1 ? "1 app aguardando pagamento" : `${itens.length} apps aguardando pagamento`}
        </h3>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/45">
        Já estão reservados no seu nome e entram no ar sozinhos assim que o pagamento cair —
        você não precisa avisar o suporte.
      </p>

      <div className="mt-4 grid gap-2">
        {itens.map((item) => (
          <div
            key={item.servico}
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
          >
            <AppIcon id={item.appSlug as ServiceId} size="sm" active={false} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-bold text-white">{item.nome}</div>
              <div className="font-sans text-[10px] text-white/35">
                {brl(item.valor)}/mês na sua mensalidade a partir do próximo ciclo
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-sm font-bold text-neon-purple">
                {brl(item.aPagar || item.valor)}
              </div>
              <div className="font-sans text-[10px] text-white/30">a pagar</div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onPagar}
        aria-label="Ir para o pagamento e liberar os apps aguardando pagamento"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neon-purple/40 bg-neon-purple/10 py-2.5 font-sans text-xs font-bold text-neon-purple transition-colors hover:bg-neon-purple/20"
      >
        Pagar {brl(total)} e liberar agora
        <ArrowRight className="size-4" />
      </button>
    </GlassCard>
  );
}

import { PiggyBank, TrendingDown } from "lucide-react";
import { GlassCard, Pill } from "../ui/kit";
import { brl, retailOf } from "@/lib/mock-data";
import { useAplicativos } from "../../queries/aplicativos";
import { parseDataBrClient } from "../../lib/datas";

/**
 * CONTADOR DE ECONOMIA.
 * Compara o preço de tabela dos apps que o cliente usa (catálogo do banco)
 * com o que ele realmente paga, e acumula desde a data de entrada. É o
 * número que segura o cliente na renovação.
 */

export function ContadorEconomia({
  apps,
  valorPago,
  ciclo,
  clienteDesde,
}: {
  apps: string[];
  valorPago: number;
  ciclo: string;
  clienteDesde: string;
}) {
  // garante que o catálogo do banco (preços oficiais) esteja registrado
  useAplicativos();

  const mensalPago = ciclo === "anual" ? valorPago / 12 : valorPago;
  const cheio = retailOf(apps);
  const economiaMes = Math.max(0, cheio - mensalPago);
  const pct = cheio > 0 ? Math.round((economiaMes / cheio) * 100) : 0;

  const inicio = parseDataBrClient(clienteDesde);
  const meses = inicio
    ? Math.max(1, Math.round((Date.now() - inicio.getTime()) / (30.44 * 86_400_000)))
    : 1;
  const acumulado = economiaMes * meses;

  if (cheio <= 0) return null;

  return (
    <GlassCard accent="cyan" className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="size-5 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">
            Quanto você já economizou
          </span>
        </div>
        <Pill accent="cyan" icon={<TrendingDown className="size-3" />}>
          {pct}% mais barato
        </Pill>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">
            Assinando separado
          </div>
          <div className="mt-1 font-display text-xl font-bold text-white/40 line-through decoration-neon-red/70 decoration-2">
            {brl(cheio)}
          </div>
        </div>
        <div>
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">
            Você paga
          </div>
          <div className="mt-1 font-display text-xl font-bold text-white">{brl(mensalPago)}</div>
        </div>
        <div>
          <div className="font-sans text-[11px] uppercase tracking-wider text-white/35">
            Economia por mês
          </div>
          <div className="mt-1 font-display text-xl font-extrabold text-neon-cyan">
            {brl(economiaMes)}
          </div>
        </div>
      </div>

      <div
        className="mt-5 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.07] p-4 text-center"
        style={{ boxShadow: "0 0 50px -22px rgba(34,211,238,0.9)" }}
      >
        <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/45">
          acumulado em {meses} {meses === 1 ? "mês" : "meses"} de PLAYPLUSNOW
        </div>
        <div className="mt-1 font-display text-3xl font-extrabold text-neon-cyan glow-cyan">
          {brl(acumulado)}
        </div>
      </div>
    </GlassCard>
  );
}

export default ContadorEconomia;

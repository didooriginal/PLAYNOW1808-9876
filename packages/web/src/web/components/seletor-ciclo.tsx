import { cn } from "@/lib/utils";
import { useTabelaCiclos, type Ciclo } from "../queries/ciclos";

/**
 * SELETOR DE PERIODICIDADE — usado na calculadora da landing e no checkout.
 *
 * Os rótulos e os percentuais vêm da tabela do servidor (`ciclos.tabela`), que é
 * a mesma usada para precificar. Aqui não existe número escrito na mão: se o
 * dono mudar o desconto anual, os botões mudam junto sem tocar em UI.
 */

const ACENTOS = {
  cyan: {
    ativo: "border-neon-cyan/60 bg-neon-cyan/10 text-white",
    texto: "text-neon-cyan",
  },
  red: {
    ativo: "border-neon-red/60 bg-neon-red/[0.09] text-white",
    texto: "text-neon-red",
  },
  purple: {
    ativo: "border-neon-purple/60 bg-neon-purple/10 text-white",
    texto: "text-neon-purple",
  },
} as const;

export function SeletorCiclo({
  valor,
  onChange,
  accent = "cyan",
  compacto = false,
  className,
}: {
  valor: Ciclo;
  onChange: (ciclo: Ciclo) => void;
  accent?: keyof typeof ACENTOS;
  /** versão de 2 colunas, para caber na coluna estreita da calculadora */
  compacto?: boolean;
  className?: string;
}) {
  const { data } = useTabelaCiclos();
  const cores = ACENTOS[accent];
  const opcoes = data?.ciclos ?? [];
  if (opcoes.length === 0) return null;

  const atual = opcoes.find((o) => o.ciclo === valor) ?? opcoes[0]!;

  return (
    <div className={className}>
      <div
        className={cn("grid gap-2", compacto ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}
        role="group"
        aria-label="Periodicidade do pagamento"
      >
        {opcoes.map((o) => {
          const on = o.ciclo === valor;
          return (
            <button
              key={o.ciclo}
              type="button"
              data-testid={`ciclo-${o.ciclo}`}
              aria-pressed={on}
              onClick={() => onChange(o.ciclo as Ciclo)}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-center transition-all",
                on
                  ? cores.ativo
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white/80",
              )}
            >
              <div className="font-display text-[12.5px] font-bold leading-tight">{o.rotulo}</div>
              <div
                className={cn(
                  "mt-0.5 font-sans text-[10px] leading-tight",
                  o.desconto > 0 ? cores.texto : "text-white/30",
                )}
              >
                {o.desconto > 0 ? `-${Math.round(o.desconto * 100)}%` : "sem desconto"}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-sans text-[10.5px] leading-relaxed text-white/30">{atual.chamada}</p>
    </div>
  );
}

export default SeletorCiclo;

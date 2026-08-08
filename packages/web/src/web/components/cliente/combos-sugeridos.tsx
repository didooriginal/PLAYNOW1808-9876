import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { brl, serviceById, whatsappLink } from "@/lib/mock-data";
import { useCombosCliente } from "../../queries/combos";
import { useAplicativos } from "../../queries/aplicativos";

/**
 * Combos que o admin marcou como "sugerir ao cliente".
 * O desconto vem calculado do servidor (soma dos avulsos × preço promocional).
 */
export function CombosSugeridos() {
  const { data, isPending } = useCombosCliente();
  // registra nome/cor dos apps do catálogo para os ícones e rótulos dos combos
  useAplicativos();
  const combos = data ?? [];

  if (isPending)
    return (
      <GlassCard className="flex items-center justify-center gap-3 p-8">
        <Loader2 className="size-4 animate-spin text-neon-cyan" />
        <span className="font-sans text-xs text-white/40">Carregando combos...</span>
      </GlassCard>
    );

  if (combos.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-sm font-bold tracking-tight text-white">
          Combos inteligentes para você
        </h3>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {combos.map((combo) => (
          <GlassCard
            key={combo.id}
            accent={combo.destaque ? "cyan" : "purple"}
            hover
            className="flex flex-col p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <Pill
                accent={combo.destaque ? "cyan" : "purple"}
                icon={<Sparkles className="size-3" />}
              >
                {combo.economiaPct > 0 ? `${combo.economiaPct}% OFF` : "Combo"}
              </Pill>
              <div className="text-right">
                <div className="font-sans text-[11px] text-white/30 line-through">
                  {brl(combo.precoCheio)}
                </div>
                <div className="font-display text-lg font-extrabold text-white">
                  {brl(combo.preco)}
                  <span className="font-sans text-[11px] font-normal text-white/40">
                    /{combo.ciclo === "anual" ? "ano" : "mês"}
                  </span>
                </div>
              </div>
            </div>

            <h4 className="mt-4 font-display text-lg font-bold text-white">{combo.nome}</h4>
            {combo.descricao && (
              <p className="mt-1.5 font-sans text-sm leading-relaxed text-white/50">
                {combo.descricao}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {combo.apps.map((slug) => (
                <span key={slug} className="flex items-center gap-1.5" title={serviceById(slug).name}>
                  <AppIcon id={slug} size="xs" />
                </span>
              ))}
            </div>

            <a
              href={whatsappLink(
                `Olá! Quero migrar para o combo ${combo.nome} (${brl(combo.preco)}/${
                  combo.ciclo === "anual" ? "ano" : "mês"
                }).`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-5"
            >
              <NeonButton
                accent={combo.destaque ? "cyan" : "purple"}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Quero este combo
                <ArrowUpRight className="size-4" />
              </NeonButton>
            </a>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export default CombosSugeridos;

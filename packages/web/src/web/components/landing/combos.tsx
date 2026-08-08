import { Sparkles, Zap } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, SectionTitle, accentHex } from "../ui/kit";
import { brl, serviceById, whatsappLink } from "@/lib/mock-data";
import { useVitrineCombos } from "../../queries/combos";
import { useAplicativos } from "../../queries/aplicativos";

/**
 * VITRINE DE COMBOS INTELIGENTES.
 * Alimentada pela tabela `combos` — o admin monta, marca "mostrar na landing" e
 * o card aparece aqui com o desconto real (soma dos avulsos × preço do combo).
 */
export function Combos() {
  const { data } = useVitrineCombos();
  // registra nome/cor dos apps do catálogo para os ícones e rótulos dos combos
  useAplicativos();
  const combos = data ?? [];

  if (combos.length === 0) return null;

  return (
    <section id="combos" className="relative px-4 py-20 sm:px-6 sm:py-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 h-72 blur-[120px]"
        style={{
          background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.14) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Combo inteligente"
          title={
            <>
              Junte seus apps favoritos e{" "}
              <span style={{ color: accentHex.cyan }}>pague muito menos</span>
            </>
          }
          subtitle="Combinações montadas pela nossa equipe com o melhor custo por app. Preço fechado, sem fidelidade."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((combo) => (
            <GlassCard
              key={combo.id}
              strong={combo.destaque}
              accent={combo.destaque ? "cyan" : "purple"}
              hover
              className="relative flex flex-col p-6"
            >
              {combo.destaque && (
                <span
                  className="absolute -top-3 left-6 rounded-full px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white"
                  style={{
                    background: "linear-gradient(135deg,#22d3ee,#0ea5e9)",
                    boxShadow: "0 0 24px -6px #22d3ee",
                  }}
                >
                  mais vendido
                </span>
              )}

              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
                  {combo.nome}
                </h3>
                {combo.economiaPct > 0 && (
                  <Pill accent="red" icon={<Sparkles className="size-3" />}>
                    {combo.economiaPct}% OFF
                  </Pill>
                )}
              </div>

              {combo.descricao && (
                <p className="mt-2 font-sans text-sm leading-relaxed text-white/50">
                  {combo.descricao}
                </p>
              )}

              <div className="mt-5 flex items-end gap-2">
                <span className="font-sans text-sm text-white/30 line-through">
                  {brl(combo.precoCheio)}
                </span>
                <span className="font-display text-3xl font-extrabold tracking-tight text-white">
                  {brl(combo.preco)}
                </span>
                <span className="pb-1 font-sans text-xs text-white/40">
                  /{combo.ciclo === "anual" ? "ano" : "mês"}
                </span>
              </div>
              {combo.economia > 0 && (
                <div
                  className="mt-1.5 font-sans text-xs font-semibold"
                  style={{ color: accentHex.cyan }}
                >
                  você economiza {brl(combo.economia)} por {combo.ciclo === "anual" ? "ano" : "mês"}
                </div>
              )}

              <div className="mt-5 flex-1 space-y-2.5">
                {combo.apps.map((slug) => (
                  <div key={slug} className="flex items-center gap-2.5">
                    <AppIcon id={slug} size="xs" />
                    <span className="font-sans text-sm text-white/70">{serviceById(slug).name}</span>
                  </div>
                ))}
              </div>

              <a
                href={whatsappLink(
                  `Olá! Quero o combo ${combo.nome} por ${brl(combo.preco)}/${
                    combo.ciclo === "anual" ? "ano" : "mês"
                  }.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-6"
              >
                <NeonButton
                  accent={combo.destaque ? "cyan" : "purple"}
                  variant={combo.destaque ? "solid" : "outline"}
                  className="w-full"
                >
                  <Zap className="size-4" />
                  Assinar combo
                </NeonButton>
              </a>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Combos;

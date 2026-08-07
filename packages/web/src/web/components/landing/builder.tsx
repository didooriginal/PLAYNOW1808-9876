import { useMemo, useState } from "react";
import {
  Calculator,
  Check,
  ChevronDown,
  MessageCircle,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, SectionTitle } from "../ui/kit";
import {
  brl,
  builderDiscount,
  builderTiers,
  retailOf,
  serviceById,
  services,
  type ServiceId,
  whatsappLink,
} from "@/lib/mock-data";

const categories = ["Todos", "Vídeo", "Música", "Extra"] as const;

export function Builder() {
  const [selected, setSelected] = useState<ServiceId[]>(["netflix", "spotify"]);
  const [category, setCategory] = useState<(typeof categories)[number]>("Todos");
  const [openMobile, setOpenMobile] = useState(false);

  const visible = useMemo(
    () => (category === "Todos" ? services : services.filter((s) => s.category === category)),
    [category],
  );

  const subtotal = useMemo(
    () => selected.reduce((sum, id) => sum + serviceById(id).price, 0),
    [selected],
  );
  const tier = builderDiscount(selected.length);
  const discount = tier ? subtotal * tier.off : 0;
  const total = subtotal - discount;
  const retail = retailOf(selected);
  const saving = retail - total;

  function toggle(id: ServiceId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const message = selected.length
    ? `Olá! Quero montar meu combo PLAPLUSNOW com: ${selected
        .map((id) => serviceById(id).name)
        .join(", ")}. Total calculado no site: ${brl(total)}/mês${tier ? ` (com ${Math.round(tier.off * 100)}% de desconto)` : ""}.`
    : "Olá! Quero montar meu combo personalizado na PLAPLUSNOW.";

  /* ---------------- calculadora (conteúdo compartilhado) ---------------- */
  const calculator = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 items-center justify-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10"
            style={{ boxShadow: "0 0 24px -8px #22d3ee" }}
          >
            <Calculator className="size-4 text-neon-cyan" />
          </span>
          <div>
            <div className="font-display text-sm font-bold text-white">Sua calculadora</div>
            <div className="font-sans text-[11px] text-white/35">
              {selected.length} {selected.length === 1 ? "app selecionado" : "apps selecionados"}
            </div>
          </div>
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 font-sans text-[11px] text-white/40 transition-colors hover:border-neon-red/40 hover:text-neon-red"
          >
            <RotateCcw className="size-3" />
            Limpar
          </button>
        )}
      </div>

      {/* lista */}
      <div className="mt-5 max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {selected.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center">
            <Sparkles className="mx-auto size-5 text-white/20" />
            <p className="mt-2 font-sans text-xs leading-relaxed text-white/35">
              Clique nos apps ao lado
              <br />
              pra montar seu combo
            </p>
          </div>
        )}
        {selected.map((id) => {
          const s = serviceById(id);
          return (
            <div
              key={id}
              className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2 pr-2.5"
            >
              <AppIcon id={id} size="xs" />
              <span className="min-w-0 flex-1 truncate font-sans text-xs text-white/70">
                {s.name}
              </span>
              <span className="font-display text-xs font-bold text-white">{brl(s.price)}</span>
              <button
                type="button"
                onClick={() => toggle(id)}
                className="flex size-5 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-neon-red/15 hover:text-neon-red"
                aria-label={`Remover ${s.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* somas */}
      <div className="mt-5 space-y-2 border-t border-dashed border-white/10 pt-4 font-sans text-xs">
        <div className="flex items-center justify-between text-white/40">
          <span>Subtotal</span>
          <span className={cn(discount > 0 && "line-through decoration-white/25")}>
            {brl(subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/40">Desconto por volume</span>
          <span className={tier ? "font-semibold text-neon-cyan" : "text-white/25"}>
            {tier ? `- ${brl(discount)} (${Math.round(tier.off * 100)}%)` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-white/40">
          <span>Preço avulso desses apps</span>
          <span className="line-through decoration-neon-red/60">{brl(retail)}</span>
        </div>
      </div>

      {/* próximo tier */}
      {(() => {
        const next = [...builderTiers].reverse().find((t) => selected.length < t.min);
        if (!next) return null;
        return (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-neon-purple/25 bg-neon-purple/[0.07] px-3 py-2.5">
            <Plus className="size-3.5 shrink-0 text-neon-purple" />
            <span className="font-sans text-[11px] leading-tight text-white/60">
              Adicione{" "}
              <strong className="text-neon-purple">{next.min - selected.length} app(s)</strong> e
              destrave <strong className="text-neon-purple">{Math.round(next.off * 100)}% OFF</strong>
            </span>
          </div>
        );
      })()}

      {/* total */}
      <div className="mt-5 rounded-2xl border border-neon-red/30 bg-neon-red/[0.07] p-4">
        <div className="flex items-end justify-between">
          <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/45">
            Total mensal
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-sans text-xs text-white/40">R$</span>
            <span className="font-display text-4xl font-extrabold leading-none text-white glow-red">
              {total.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
        {saving > 0 && (
          <div className="mt-3 flex items-center gap-1.5 font-sans text-[11px] text-neon-cyan">
            <TrendingDown className="size-3.5" />
            você economiza {brl(saving)} por mês
          </div>
        )}
      </div>

      <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className="mt-4 block">
        <NeonButton accent="red" size="lg" className="w-full" disabled={selected.length === 0}>
          <MessageCircle className="size-4" />
          Finalizar via WhatsApp
        </NeonButton>
      </a>
      <p className="mt-2.5 text-center font-sans text-[10px] leading-relaxed text-white/25">
        Sem cartão agora. Um atendente confirma os acessos antes do pagamento.
      </p>
    </>
  );

  return (
    <section id="montador" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="À la carte"
          accent="purple"
          title={
            <>
              Monte seu próprio{" "}
              <span className="text-neon-purple" style={{ textShadow: "0 0 22px rgba(168,85,247,0.6)" }}>
                Combo
              </span>
            </>
          }
          subtitle="Escolha só o que você realmente assiste. Quanto mais apps, maior o desconto — a calculadora atualiza em tempo real."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---------- grade ---------- */}
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-4 py-2 font-sans text-xs font-medium transition-all",
                    category === c
                      ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                      : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70",
                  )}
                >
                  {c}
                </button>
              ))}
              <span className="ml-auto hidden font-sans text-[11px] text-white/25 sm:block">
                {builderTiers.map((t) => t.label).join("  ·  ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((s) => {
                const active = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all duration-300",
                      active
                        ? "-translate-y-1 border-neon-cyan/50 bg-neon-cyan/[0.07]"
                        : "border-white/8 bg-white/[0.025] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]",
                    )}
                    style={
                      active
                        ? { boxShadow: "0 0 34px -12px rgba(34,211,238,0.8), inset 0 1px 0 rgba(255,255,255,0.1)" }
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full border transition-all",
                        active
                          ? "border-neon-cyan bg-neon-cyan text-black"
                          : "border-white/15 bg-white/5 text-transparent group-hover:border-white/30",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>

                    <AppIcon id={s.id} size="md" active={active} />

                    <div>
                      <div className="font-display text-sm font-semibold leading-tight text-white">
                        {s.name}
                      </div>
                      <div className="mt-1 font-sans text-[10px] uppercase tracking-widest text-white/30">
                        {s.category}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="font-display text-lg font-extrabold text-white">
                        {brl(s.price)}
                      </div>
                      <div className="font-sans text-[10px] text-white/30 line-through decoration-neon-red/50">
                        {brl(s.retail)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {builderTiers
                .slice()
                .reverse()
                .map((t) => (
                  <Pill
                    key={t.min}
                    accent={selected.length >= t.min ? "cyan" : "purple"}
                    className={selected.length >= t.min ? "" : "opacity-40"}
                  >
                    {t.label}
                  </Pill>
                ))}
            </div>
          </div>

          {/* ---------- calculadora sticky (desktop) ---------- */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <GlassCard strong accent="cyan" className="p-5">
                {calculator}
              </GlassCard>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- calculadora flutuante (mobile) ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden">
        {openMobile && (
          <GlassCard strong accent="cyan" className="mb-2 max-h-[70vh] overflow-y-auto p-5">
            {calculator}
          </GlassCard>
        )}
        <button
          type="button"
          onClick={() => setOpenMobile((v) => !v)}
          className="glass-strong flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ boxShadow: "0 0 40px -16px rgba(34,211,238,0.9)" }}
        >
          <span className="flex items-center gap-2">
            <Calculator className="size-4 text-neon-cyan" />
            <span className="font-sans text-xs text-white/60">
              {selected.length} {selected.length === 1 ? "app" : "apps"}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-display text-lg font-extrabold text-white">{brl(total)}</span>
            <ChevronDown
              className={cn("size-4 text-white/40 transition-transform", openMobile && "rotate-180")}
            />
          </span>
        </button>
      </div>
    </section>
  );
}

export default Builder;

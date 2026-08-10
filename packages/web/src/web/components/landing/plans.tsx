import { useState } from "react";
import { Link } from "wouter";
import { Check, Crown, Flame, UserPlus, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, SectionTitle, accentHex } from "../ui/kit";
import { brl, retailOf, savingsPct } from "@/lib/mock-data";
import { usePlanos } from "../../lib/planos";

export type Cycle = "monthly" | "yearly";

function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="glass relative flex items-center rounded-full p-1.5">
        <span
          className="absolute inset-y-1.5 w-[calc(50%-6px)] rounded-full transition-transform duration-400 ease-out"
          style={{
            transform: cycle === "monthly" ? "translateX(0)" : "translateX(100%)",
            left: 6,
            background: "linear-gradient(135deg, #ff1f3d 0%, #ff1f3dcc 100%)",
            boxShadow: "0 0 30px -8px #ff1f3d, inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        />
        {(
          [
            { id: "monthly", label: "Mensal" },
            { id: "yearly", label: "Anual" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative z-10 w-32 rounded-full py-2.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors duration-300",
              cycle === opt.id ? "text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className={cn("transition-opacity duration-300", cycle === "yearly" ? "opacity-100" : "opacity-40")}>
        <Pill accent="cyan" icon={<Zap className="size-3" />}>
          Plano anual: 2 meses grátis
        </Pill>
      </div>
    </div>
  );
}

export function Plans() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const yearly = cycle === "yearly";
  // pacotes vindos da tabela `pacotes` (Turso/Drizzle)
  const { planos } = usePlanos();

  return (
    <section id="pacotes" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-72 blur-[120px]"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(255,31,61,0.14) 0%, transparent 70%)" }}
      />
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Pacotes prontos"
          title={
            <>
              Escolha o combo e{" "}
              <span className="text-neon-cyan glow-cyan">garanta sua vaga</span>
            </>
          }
          subtitle="Vagas limitadas por conta matriz — quando lota, entra fila de espera. Troque de pacote quando quiser, sem multa."
        />

        <div className="mt-10 flex justify-center">
          <CycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {planos.map((plan, index) => {
            const monthly = yearly ? plan.yearlyMonthly : plan.monthly;
            const retail = retailOf(plan.items);
            const pct = savingsPct(retail, monthly);
            const hex = accentHex[plan.accent];
            const filled = Math.max(0, 100 - plan.slotsLeft * 5);

            return (
              <GlassCard
                key={plan.id}
                accent={plan.accent}
                strong={plan.highlight}
                hover
                className={cn(
                  "animate-rise relative flex flex-col p-6 sm:p-7",
                  plan.highlight && "lg:-mt-6 lg:mb-6 lg:scale-[1.03]",
                )}
                style={{ animationDelay: `${index * 110}ms` }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Pill accent={plan.accent} icon={plan.highlight ? <Flame className="size-3" /> : <Crown className="size-3" />}>
                      {plan.badge}
                    </Pill>
                  </div>
                )}

                <div className="mt-2">
                  <h3 className="font-display text-2xl font-extrabold tracking-tight text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 font-sans text-sm text-white/45">{plan.tagline}</p>
                </div>

                {/* preço */}
                <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-sm text-white/40">R$</span>
                    <span
                      className="font-display text-5xl font-extrabold leading-none text-white transition-all duration-500"
                      style={{ textShadow: `0 0 18px ${hex}88` }}
                    >
                      {monthly.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="font-sans text-sm text-white/40">/mês</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="font-sans text-xs text-white/30 line-through decoration-neon-red/60">
                      {brl(retail)} separado
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 font-display text-[11px] font-bold"
                      style={{ background: `${hex}1f`, color: hex }}
                    >
                      -{pct}%
                    </span>
                  </div>
                  <div className="mt-2 font-sans text-[11px] text-white/35">
                    {yearly
                      ? `cobrado ${brl(monthly * 12)} por ano · 12 meses travados`
                      : "sem fidelidade · cancele quando quiser"}
                  </div>
                </div>

                {/* apps inclusos */}
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                      Apps inclusos
                    </span>
                    <span className="font-display text-xs font-bold" style={{ color: hex }}>
                      {plan.items.length} apps
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    {plan.items.map((id) => (
                      <AppIcon key={id} id={id} size="xs" active={plan.highlight} />
                    ))}
                  </div>
                </div>

                {/* perks */}
                <ul className="mt-6 space-y-2.5">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${hex}22`, color: hex }}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="font-sans text-sm text-white/60">{perk}</span>
                    </li>
                  ))}
                </ul>

                {/* lotação */}
                <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between font-sans text-[11px]">
                    <span className="flex items-center gap-1.5 text-white/40">
                      <Users className="size-3.5" />
                      Vagas nesta rodada
                    </span>
                    <span className="font-display font-bold" style={{ color: plan.slotsLeft <= 5 ? "#ff1f3d" : hex }}>
                      {plan.slotsLeft} restantes
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${filled}%`,
                        background: `linear-gradient(90deg, ${hex}55, ${hex})`,
                        boxShadow: `0 0 12px -2px ${hex}`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex-1" />

                {/* checkout na plataforma: resumo + Pix + ativação automática */}
                <Link
                  to={`/checkout?plano=${plan.id}&ciclo=${yearly ? "anual" : "mensal"}`}
                  className="block"
                >
                  <NeonButton
                    accent={plan.accent}
                    variant={plan.highlight ? "solid" : "outline"}
                    size="lg"
                    className="w-full"
                  >
                    <UserPlus className="size-4" />
                    Garantir Vaga
                  </NeonButton>
                </Link>
                <p className="mt-3 text-center font-sans text-[11px] text-white/25">
                  Pagamento por Pix no site — acessos liberados automaticamente
                </p>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Plans;

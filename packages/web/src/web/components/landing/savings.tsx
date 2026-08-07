import { ArrowRight, BadgeCheck, Flame, TrendingDown, Wallet } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, Pill, SectionTitle } from "../ui/kit";
import { brl, plans, retailOf, savingsPct } from "@/lib/mock-data";

const mega = plans.find((p) => p.id === "mega-promo") as (typeof plans)[number];
const retail = retailOf(mega.items);
const combo = mega.monthly;
const pct = savingsPct(retail, combo);
const yearSaving = (retail - combo) * 12;

export function Savings() {
  return (
    <section id="economia" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="A conta não fecha"
          accent="cyan"
          title={
            <>
              Você está pagando{" "}
              <span className="text-neon-red glow-red">{pct}% mais caro</span> pelo mesmo
              entretenimento
            </>
          }
          subtitle="Compare o que sai da sua conta hoje com o que sairia dentro de um combo compartilhado da PLAPLUSNOW. Mesmos apps, mesma qualidade de imagem, uma fração do valor."
        />

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* ---------- separado ---------- */}
          <GlassCard className="relative overflow-hidden p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/35">
                  Assinando separado
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-white/80">
                  Do jeito tradicional
                </h3>
              </div>
              <Wallet className="size-8 text-white/15" />
            </div>

            <ul className="mt-7 space-y-1">
              {mega.items.map((id) => {
                const s = retailOf([id]);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <AppIcon id={id} size="xs" className="opacity-60 grayscale" />
                    <span className="flex-1 truncate font-sans text-sm text-white/45">
                      <ServiceName id={id} />
                    </span>
                    <span className="font-display text-sm font-semibold text-white/40 line-through decoration-white/25">
                      {brl(s)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 border-t border-dashed border-white/10 pt-5">
              <div className="flex items-end justify-between">
                <span className="font-sans text-xs uppercase tracking-[0.2em] text-white/35">
                  Total por mês
                </span>
                <span className="font-display text-3xl font-extrabold text-white/35 line-through decoration-neon-red/80 decoration-[3px]">
                  {brl(retail)}
                </span>
              </div>
              <p className="mt-3 font-sans text-xs leading-relaxed text-white/30">
                7 cobranças diferentes no cartão, 7 reajustes por ano, zero suporte em português de
                verdade.
              </p>
            </div>
          </GlassCard>

          {/* ---------- divisor ---------- */}
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="hidden h-20 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
              <div
                className="flex size-16 items-center justify-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10 backdrop-blur-xl"
                style={{ boxShadow: "0 0 40px -10px rgba(34,211,238,0.8)" }}
              >
                <TrendingDown className="size-7 text-neon-cyan" />
              </div>
              <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-neon-cyan">
                -{pct}%
              </span>
              <div className="hidden h-20 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
            </div>
          </div>

          {/* ---------- combo ---------- */}
          <GlassCard accent="red" className="relative overflow-hidden p-6 sm:p-8">
            <div
              className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(255,31,61,0.3) 0%, transparent 70%)" }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <div className="font-sans text-[11px] uppercase tracking-[0.24em] text-neon-red">
                  No combo PLAPLUSNOW
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-white">
                  Pacote {mega.name}
                </h3>
              </div>
              <Flame className="size-8 text-neon-red" />
            </div>

            <div className="relative mt-7 grid grid-cols-4 gap-3 sm:grid-cols-7">
              {mega.items.map((id) => (
                <AppIcon key={id} id={id} size="sm" active />
              ))}
            </div>

            <ul className="relative mt-7 space-y-2.5">
              {[
                "Os mesmos 7 apps, uma cobrança só",
                "Netflix em 4K e Spotify sem anúncio",
                "Painel com login e senha de cada app",
                "Suporte humano no WhatsApp 24/7",
              ].map((perk) => (
                <li key={perk} className="flex items-start gap-2.5">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-neon-cyan" />
                  <span className="font-sans text-sm text-white/65">{perk}</span>
                </li>
              ))}
            </ul>

            <div className="relative mt-7 border-t border-dashed border-white/10 pt-5">
              <div className="flex items-end justify-between">
                <span className="font-sans text-xs uppercase tracking-[0.2em] text-white/45">
                  Total por mês
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-white glow-red">
                    {brl(combo).replace("R$", "").trim()}
                  </span>
                  <span className="font-sans text-xs text-white/40">/mês</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill accent="cyan">Você economiza {brl(retail - combo)}/mês</Pill>
                <Pill accent="purple">{brl(yearSaving)} por ano</Pill>
              </div>
              <a href="#pacotes" className="mt-5 block">
                <NeonButton accent="red" size="lg" className="w-full">
                  Quero economizar agora
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </NeonButton>
              </a>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

function ServiceName({ id }: { id: (typeof mega.items)[number] }) {
  const names: Record<string, string> = {
    netflix: "Netflix Premium",
    disney: "Disney+ Padrão",
    hbomax: "HBO Max Platinum",
    prime: "Prime Video",
    spotify: "Spotify Premium",
    youtube: "YouTube Premium",
    crunchyroll: "Crunchyroll Mega Fan",
  };
  return <>{names[id] ?? id}</>;
}

export default Savings;

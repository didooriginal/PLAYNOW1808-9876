import {
  ArrowRight,
  ChevronRight,
  HelpCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { Logo } from "../logo";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { brl, retailOf, savingsPct, services, socialStats } from "@/lib/mock-data";
import { usePlanoDestaque } from "../../lib/planos";

function IconMarquee() {
  const row = [...services, ...services];
  return (
    <div className="relative w-full overflow-hidden py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max animate-marquee items-center gap-4">
        {row.map((s, i) => (
          <div key={`${s.id}-${i}`} className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <AppIcon id={s.id} size="xs" />
            <span className="whitespace-nowrap font-sans text-xs text-white/45">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  // pacote em destaque no banco — alimenta o card comparativo do hero
  const mega = usePlanoDestaque();
  const megaRetail = retailOf(mega.items);
  const megaSavings = savingsPct(megaRetail, mega.monthly);

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pt-40">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* -------- coluna esquerda -------- */}
          <div className="min-w-0 animate-rise">
            <div className="mb-8 flex justify-center lg:justify-start">
              <Logo size="lg" />
            </div>

            <div className="mb-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              <a href="#economia" className="group">
                <Pill
                  accent="red"
                  icon={<Zap className="size-3" />}
                  className="transition-all hover:bg-neon-red/20"
                >
                  Economize até 80%
                  <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Pill>
              </a>
              <Pill accent="cyan" icon={<ShieldCheck className="size-3" />}>
                Ativação em 10 min
              </Pill>
              <Pill accent="purple" icon={<Star className="size-3" />}>
                5.4k+ Clientes
              </Pill>
            </div>

            <h1 className="text-center font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-left xl:text-6xl">
              Chega de pagar caro
              <br />
              em{" "}
              <span className="relative inline-block text-neon-red [text-shadow:0_0_28px_rgba(255,31,61,0.45)]">
                várias
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-neon-red to-transparent"
                />
              </span>{" "}
              assinaturas.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-center font-sans text-base leading-relaxed text-white/55 sm:text-lg lg:mx-0 lg:text-left">
              Quer curtir seus streamings favoritos economizando de verdade? A PLAYPLUSNOW dá acesso
              aos melhores conteúdos do mercado com preço acessível e suporte especializado. Assine,
              economize e aproveite.
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <a href="#pacotes" className="sm:w-auto">
                <NeonButton accent="red" size="lg" className="w-full sm:w-auto">
                  Ver pacotes prontos
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </NeonButton>
              </a>
              <a href="#montador" className="sm:w-auto">
                <NeonButton accent="cyan" variant="outline" size="lg" className="w-full sm:w-auto">
                  <Sparkles className="size-4" />
                  Montar meu combo
                </NeonButton>
              </a>
              <a href="#faq" className="sm:w-auto">
                <NeonButton
                  variant="ghost"
                  size="lg"
                  className="w-full gap-2 border border-white/5 bg-white/5 sm:w-auto"
                >
                  <HelpCircle className="size-4" />
                  Dúvidas frequentes
                </NeonButton>
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {socialStats.map((s) => (
                <div key={s.label} className="border-l border-white/10 pl-3">
                  <div className="font-display text-xl font-extrabold text-white sm:text-2xl">
                    {s.value}
                  </div>
                  <div className="mt-0.5 font-sans text-[11px] leading-tight text-white/35">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* -------- coluna direita: mock do painel -------- */}
          <div className="relative min-w-0 animate-rise [animation-delay:150ms]">
            <div
              className="absolute -inset-6 -z-10 rounded-[42px] blur-3xl"
              style={{
                background:
                  "radial-gradient(60% 60% at 70% 20%, rgba(255,31,61,0.28) 0%, transparent 70%), radial-gradient(50% 50% at 20% 80%, rgba(34,211,238,0.22) 0%, transparent 70%)",
              }}
            />

            <GlassCard strong accent="red" className="animate-float p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2.5">
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-neon-red" />
                    <span className="relative size-2.5 rounded-full bg-neon-red" />
                  </span>
                  <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Combo ativo
                  </span>
                </div>
                <span className="font-display text-xs font-semibold text-neon-cyan">{mega.name}</span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Você paga
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-display text-5xl font-extrabold text-white glow-red">
                      {Math.trunc(mega.monthly)}
                    </span>
                    <span className="font-display text-2xl font-bold text-white/70">
                      ,{Math.round((mega.monthly % 1) * 100).toString().padStart(2, "0")}
                    </span>
                    <span className="ml-1 font-sans text-xs text-white/35">/mês</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Separado sairia
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-white/30 line-through decoration-neon-red/70 decoration-2">
                    {brl(megaRetail)}
                  </div>
                  <div className="mt-1 font-sans text-[11px] text-neon-cyan">economia de {megaSavings}%</div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-5 gap-3 sm:grid-cols-5">
                {mega.items.map((id) => (
                  <div key={id} className="flex flex-col items-center gap-1.5">
                    <AppIcon id={id} size="sm" active />
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <PlayCircle className="size-9 text-neon-red" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-sans text-sm text-white">
                      Acessos liberados no painel
                    </div>
                    <div className="mt-0.5 font-sans text-[11px] text-white/35">
                      e-mail + senha de cada app, com troca automática
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="mt-6">
              <IconMarquee />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;

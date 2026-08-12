import { Quote, ShieldCheck, Star, Timer, Wallet } from "lucide-react";
import { GlassCard, Pill, SectionTitle } from "../ui/kit";
import { testimonials } from "@/lib/mock-data";

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Qualidade garantida",
    text: "Contas conferidas uma a uma antes de entrar no seu painel.",
    accent: "cyan" as const,
  },
  {
    icon: Timer,
    title: "Reposição automática",
    text: "Se a conta matriz cair, você recebe um novo acesso na hora.",
    accent: "purple" as const,
  },
  {
    icon: Wallet,
    title: "Sem fidelidade",
    text: "Cancele, troque ou faça upgrade de pacote quando quiser.",
    accent: "red" as const,
  },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={i < n ? "size-3.5 fill-neon-red text-neon-red" : "size-3.5 text-white/15"}
          style={i < n ? { filter: "drop-shadow(0 0 5px rgba(255,31,61,0.8))" } : undefined}
        />
      ))}
    </div>
  );
}

export function SocialProof() {
  return (
    <section id="depoimentos" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Quem acredita na gente"
          title={
            <>
              <span className="text-neon-red glow-red">5.4k+</span> assinaturas ativas pagando
              menos todo mês
            </>
          }
          subtitle="Quem entrou parou de pagar uma fatura por streaming e passou a pagar uma só. Estes são depoimentos de assinantes reais da PLAYPLUSNOW."
        />

        <div className="mt-14 columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
          {testimonials.map((t, i) => (
            <GlassCard
              key={t.handle}
              hover
              accent={i % 3 === 0 ? "red" : i % 3 === 1 ? "cyan" : "purple"}
              className="animate-rise break-inside-avoid p-6"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <Stars n={t.stars} />
                <Quote className="size-6 shrink-0 text-white/10" />
              </div>

              <p className="mt-4 font-sans text-sm leading-relaxed text-white/70">"{t.text}"</p>

              <div className="mt-5 flex items-center gap-3 border-t border-white/8 pt-4">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] font-display text-xs font-bold text-white/70"
                  aria-hidden
                >
                  {t.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold text-white">
                    {t.name}
                  </div>
                  <div className="truncate font-sans text-[11px] text-white/35">
                    {t.handle} · {t.city}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Pill accent="cyan" className="!text-[10px]">
                  {t.since}
                </Pill>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {guarantees.map((g) => (
            <GlassCard key={g.title} className="flex items-start gap-4 p-5">
              <span
                className={
                  g.accent === "cyan"
                    ? "flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan"
                    : g.accent === "purple"
                      ? "flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neon-purple/35 bg-neon-purple/10 text-neon-purple"
                      : "flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neon-red/35 bg-neon-red/10 text-neon-red"
                }
              >
                <g.icon className="size-5" />
              </span>
              <div>
                <div className="font-display text-sm font-bold text-white">{g.title}</div>
                <p className="mt-1 font-sans text-xs leading-relaxed text-white/45">{g.text}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SocialProof;

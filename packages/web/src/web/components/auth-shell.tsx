import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Logo } from "./logo";
import { GlassCard, NeonBackdrop, Pill } from "./ui/kit";
import type { Accent } from "@/lib/mock-data";

const provas = [
  { icon: Zap, label: "Ativação em até 10 minutos" },
  { icon: ShieldCheck, label: "Contas monitoradas 24/7" },
  { icon: Sparkles, label: "Troque de pacote sem multa" },
];

/** Moldura das telas de login/cadastro — mesmo visual dark/glass/neon da landing. */
export function AuthShell({
  accent = "cyan",
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  accent?: Accent;
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <NeonBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link to="/">
            <Logo size="sm" withTagline={false} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-sans text-xs text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Voltar ao site
          </Link>
        </div>

        <div className="my-auto grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* --------- coluna de argumento (desktop) --------- */}
          <div className="hidden lg:block">
            <Pill accent={accent}>{eyebrow}</Pill>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-white/50">
              {subtitle}
            </p>
            <ul className="mt-10 space-y-4">
              {provas.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-sans text-sm text-white/60">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* --------- card do formulário --------- */}
          <GlassCard strong accent={accent} className="p-6 sm:p-8">
            <div className="lg:hidden">
              <Pill accent={accent}>{eyebrow}</Pill>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-3 font-sans text-sm leading-relaxed text-white/45">{subtitle}</p>
              <div className="my-6 h-px bg-white/8" />
            </div>
            {children}
          </GlassCard>
        </div>

        {footer ? <div className="pb-4">{footer}</div> : null}
      </div>
    </main>
  );
}

/** Input com o acabamento glass usado no admin. */
export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-1.5 block font-sans text-[11px] text-white/30">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-neon-cyan/60 focus:bg-white/[0.06]";

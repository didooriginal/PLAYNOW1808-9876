import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Accent } from "@/lib/mock-data";

export const accentHex: Record<Accent, string> = {
  red: "#ff1f3d",
  cyan: "#22d3ee",
  purple: "#a855f7",
};

export const accentEdge: Record<Accent, string> = {
  red: "neon-red-edge",
  cyan: "neon-cyan-edge",
  purple: "neon-purple-edge",
};

export const accentText: Record<Accent, string> = {
  red: "text-neon-red",
  cyan: "text-neon-cyan",
  purple: "text-neon-purple",
};

/* ------------------------------------------------------------------ */

export function GlassCard({
  children,
  className,
  accent,
  strong = false,
  hover = false,
  ...rest
}: ComponentProps<"div"> & { accent?: Accent; strong?: boolean; hover?: boolean }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-3xl",
        accent && accentEdge[accent],
        hover &&
          "transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_40px_90px_-40px_rgba(0,0,0,1)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function NeonButton({
  children,
  className,
  accent = "red",
  variant = "solid",
  size = "md",
  ...rest
}: ComponentProps<"button"> & {
  accent?: Accent;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const hex = accentHex[accent];
  const sizes = {
    sm: "h-9 px-4 text-xs",
    md: "h-11 px-5 text-sm",
    lg: "h-14 px-7 text-base",
  };

  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-display font-semibold uppercase tracking-wide transition-all duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        sizes[size],
        variant === "solid" && "text-white",
        variant === "outline" && "border bg-white/[0.03] text-white hover:bg-white/[0.07]",
        variant === "ghost" && "text-white/60 hover:bg-white/[0.05] hover:text-white",
        className,
      )}
      style={
        variant === "solid"
          ? {
              background: `linear-gradient(135deg, ${hex} 0%, ${hex}cc 55%, ${hex}88 100%)`,
              boxShadow: `0 0 0 1px ${hex}66, 0 12px 40px -12px ${hex}cc, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }
          : variant === "outline"
            ? { borderColor: `${hex}66`, boxShadow: `0 0 24px -12px ${hex}` }
            : undefined
      }
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {variant === "solid" && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function Pill({
  children,
  accent = "cyan",
  className,
  icon,
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
  icon?: ReactNode;
}) {
  const hex = accentHex[accent];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.14em] backdrop-blur-md",
        className,
      )}
      style={{
        borderColor: `${hex}55`,
        color: hex,
        background: `${hex}14`,
        boxShadow: `0 0 22px -12px ${hex}`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  max,
  danger,
  className,
}: {
  value: number;
  max: number;
  danger?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const full = value >= max;
  const isDanger = danger ?? full;
  const nearlyFull = !isDanger && pct >= 75;

  const color = isDanger ? "#ff1f3d" : nearlyFull ? "#f59e0b" : "#22d3ee";

  return (
    <div
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.04]",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}55 0%, ${color} 100%)`,
          boxShadow: `0 0 14px -2px ${color}, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
  accent = "red",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  accent?: Accent;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow && (
        <div className={cn("mb-4 flex", align === "center" ? "justify-center" : "justify-start")}>
          <Pill accent={accent}>{eyebrow}</Pill>
        </div>
      )}
      <h2 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-white/50 sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** fundo global: grid, glows e ruído */
export function NeonBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute inset-0 grid-bg opacity-70" />
      <div
        className="absolute -left-40 -top-40 size-[620px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(255,31,61,0.22) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-32 top-[18%] size-[560px] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-14%] left-1/3 size-[680px] rounded-full blur-[150px]"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.16) 0%, transparent 70%)" }}
      />
      <div className="absolute inset-0 noise opacity-[0.035] mix-blend-overlay" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-red/60 to-transparent" />
    </div>
  );
}

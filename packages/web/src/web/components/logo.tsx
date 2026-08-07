import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  className?: string;
};

const sizes = {
  sm: { top: "text-[7px] tracking-[0.42em]", now: "text-2xl", stroke: "1px", tagline: "text-[7px] tracking-[0.28em]" },
  md: { top: "text-[9px] tracking-[0.5em]", now: "text-4xl", stroke: "1.5px", tagline: "text-[9px] tracking-[0.3em]" },
  lg: { top: "text-xs tracking-[0.6em]", now: "text-7xl sm:text-8xl", stroke: "2.5px", tagline: "text-xs tracking-[0.42em]" },
};

export function Logo({ size = "md", withTagline = true, className }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex select-none flex-col items-center leading-none", className)}>
      <span
        className={cn(
          "font-display font-semibold uppercase text-white/70",
          s.top,
        )}
      >
        Play Plus
      </span>
      <span
        className={cn("font-display font-extrabold uppercase leading-[0.85] animate-flicker", s.now)}
        style={{
          color: "transparent",
          WebkitTextStroke: `${s.stroke} #ff1f3d`,
          textShadow:
            "0 0 10px rgba(255,31,61,0.85), 0 0 34px rgba(255,31,61,0.55), 0 0 76px rgba(255,31,61,0.3)",
        }}
      >
        Now
      </span>
      {withTagline && (
        <span className={cn("mt-1 font-sans uppercase text-white/35", s.tagline)}>
          Entretenimento de verdade
        </span>
      )}
    </div>
  );
}

export default Logo;

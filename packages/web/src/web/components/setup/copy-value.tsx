import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo somente-leitura com copiar e, opcionalmente, esconder o valor (senhas).
 */
export function CopyValue({
  label,
  value,
  secreto = false,
  className,
}: {
  label: string;
  value: string;
  secreto?: boolean;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [visivel, setVisivel] = useState(!secreto);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div className={cn("min-w-0", className)}>
      <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
        {label}
      </span>
      <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/85">
          {visivel ? value : "•".repeat(Math.min(value.length, 14))}
        </code>
        {secreto && (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Esconder" : "Mostrar"}
            className="shrink-0 rounded-md p-1 text-white/35 transition-colors hover:text-white"
          >
            {visivel ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={copiar}
          aria-label="Copiar"
          className="shrink-0 rounded-md p-1 text-white/35 transition-colors hover:text-white"
        >
          {copiado ? <Check className="size-3.5 text-neon-cyan" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

type Linha = {
  /** comando digitado no terminal */
  cmd: string;
  /** comentário explicativo mostrado à direita, em cinza */
  nota?: string;
};

/**
 * Bloco de terminal com botão de copiar.
 * Copia só os comandos (sem os comentários), então o usuário pode colar direto.
 */
export function CodeBlock({
  linhas,
  cwd,
  className,
  prompt = true,
}: {
  linhas: Linha[];
  cwd?: string;
  className?: string;
  /** false para conteúdo de arquivo (ex.: .env), que não é comando de shell */
  prompt?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const texto = linhas.map((l) => l.cmd).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-[#07070a]/90",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="size-3.5 shrink-0 text-neon-cyan" />
          <span className="truncate font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
            {cwd ?? "terminal"}
          </span>
        </div>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-sans text-[11px] text-white/45 transition-colors hover:border-white/25 hover:text-white"
        >
          {copiado ? (
            <>
              <Check className="size-3 text-neon-cyan" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copiar
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="block font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
          {linhas.map((l, i) => (
            <span key={i} className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-white/85">
                {prompt && <span className="mr-2 select-none text-neon-red/70">$</span>}
                {l.cmd}
              </span>
              {l.nota && <span className="text-white/25"># {l.nota}</span>}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

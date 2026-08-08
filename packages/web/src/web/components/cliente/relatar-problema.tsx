import { useState } from "react";
import { Check, LifeBuoy, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton } from "../ui/kit";
import { TIPOS_PROBLEMA, useAbrirChamado } from "../../queries/suporte";

/**
 * Botão + formulário de "Relatar problema" no painel do cliente.
 * O cliente escolhe o tipo do problema e descreve; o chamado cai na fila do admin.
 */
export function RelatarProblema({
  servico,
  contaId,
  compact = false,
}: {
  servico?: string;
  contaId?: number | null;
  compact?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS_PROBLEMA)[number]["id"]>("senha_incorreta");
  const [descricao, setDescricao] = useState("");
  const [enviado, setEnviado] = useState(false);
  const abrir = useAbrirChamado();

  function enviar() {
    abrir.mutate(
      { tipo, descricao, servico: servico ?? null, contaId: contaId ?? null },
      {
        onSuccess: () => {
          setEnviado(true);
          setDescricao("");
          window.setTimeout(() => {
            setEnviado(false);
            setAberto(false);
          }, 2200);
        },
      },
    );
  }

  if (!aberto) {
    return (
      <NeonButton
        accent="purple"
        variant="outline"
        size="sm"
        className={compact ? "" : "w-full"}
        onClick={() => setAberto(true)}
      >
        <LifeBuoy className="size-3.5" />
        Relatar problema
      </NeonButton>
    );
  }

  return (
    <GlassCard strong accent="purple" className="w-full p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-xs font-bold text-white">
          <LifeBuoy className="size-3.5 text-neon-purple" />
          Relatar problema
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="text-white/40 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {enviado ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3">
          <Check className="size-4 text-emerald-300" />
          <span className="font-sans text-xs text-emerald-200">
            Chamado enviado! Nossa equipe já foi avisada.
          </span>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TIPOS_PROBLEMA.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-[11px] transition-all",
                  tipo === t.id
                    ? "border-neon-purple/60 bg-neon-purple/15 text-neon-purple"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Conte o que aconteceu (opcional)"
            className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-xs text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />

          {abrir.isError && (
            <p className="mt-2 font-sans text-[11px] text-neon-red">{abrir.error?.message}</p>
          )}

          <NeonButton
            accent="purple"
            size="sm"
            className="mt-3 w-full"
            disabled={abrir.isPending}
            onClick={enviar}
          >
            {abrir.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Enviar chamado
          </NeonButton>
        </>
      )}
    </GlassCard>
  );
}

export default RelatarProblema;

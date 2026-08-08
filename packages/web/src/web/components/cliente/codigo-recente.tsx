import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, Timer } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, Pill } from "../ui/kit";
import { useMeuCodigo, haQuantoTempo, minutosRestantes } from "../../queries/codigos";

/**
 * "Seu código de acesso recente".
 * Quando o streaming pede a verificação por e-mail, o código cai aqui em
 * segundos — sem o cliente precisar abrir chamado. Some sozinho depois de 1h.
 */
export function CodigoRecente() {
  const { data, isPending, isFetching, refetch } = useMeuCodigo();
  const [copiado, setCopiado] = useState<number | null>(null);

  const codigos = data ?? [];
  const principal = codigos[0];

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-neon-cyan" />
          <span className="font-display text-sm font-bold text-white">
            Seu código de acesso recente
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 font-sans text-[11px] text-white/40 transition-colors hover:text-white"
        >
          <RefreshCw className={isFetching ? "size-3 animate-spin" : "size-3"} />
          atualizar
        </button>
      </div>

      {isPending ? (
        <div className="mt-4 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-neon-cyan" />
          <span className="font-sans text-xs text-white/40">Procurando códigos...</span>
        </div>
      ) : !principal ? (
        <p className="mt-3 font-sans text-xs leading-relaxed text-white/45">
          Nenhum código no momento. Quando o app pedir um código de verificação enviado por e-mail,
          ele aparece aqui automaticamente — atualize esta tela após solicitar.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {codigos.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3"
            >
              <AppIcon id={c.servicoSlug} size="sm" active />
              <div className="min-w-[110px] flex-1">
                <div className="font-display text-sm font-bold text-white">{c.servico}</div>
                <div className="font-sans text-[11px] text-white/35">
                  {haQuantoTempo(c.recebidoEm)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(c.codigo);
                  setCopiado(c.id);
                  setTimeout(() => setCopiado(null), 1800);
                }}
                title="Copiar código"
                className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/[0.07] px-4 py-2 transition-colors hover:border-neon-cyan/60"
              >
                <span className="font-display text-xl font-extrabold tracking-[0.22em] text-neon-cyan">
                  {c.codigo}
                </span>
                {copiado === c.id ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5 text-white/40" />
                )}
              </button>

              <Pill
                accent={minutosRestantes(c.recebidoEm) < 10 ? "red" : "cyan"}
                icon={<Timer className="size-3" />}
              >
                expira em {minutosRestantes(c.recebidoEm)} min
              </Pill>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

export default CodigoRecente;

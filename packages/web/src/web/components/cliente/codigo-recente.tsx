import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, Timer } from "lucide-react";
import { AppIcon } from "../app-icon";
import { GlassCard, Pill } from "../ui/kit";
import { contagem, useMarcarUsado, useMeuCodigo } from "../../queries/codigos";

/**
 * "Seu código de acesso recente" no painel.
 *
 * Mostra apenas o que foi ENTREGUE a este cliente — ou seja, o código que
 * chegou depois de ele clicar em "Pedi o código agora" na tela do aplicativo.
 * Código de conta compartilhada sem pedido casado nunca aparece aqui.
 */
export function CodigoRecente() {
  const { data, isPending, isFetching, refetch } = useMeuCodigo();
  const usar = useMarcarUsado();
  const [copiado, setCopiado] = useState<number | null>(null);
  const [, forcar] = useState(0);

  // relógio de 1s para a contagem regressiva andar entre os refetches
  useEffect(() => {
    const t = setInterval(() => forcar((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const codigos = data?.codigos ?? [];
  const pedido = data?.pedido ?? null;
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
        <div className="mt-3 space-y-2">
          {pedido ? (
            <p className="flex items-center gap-2 font-sans text-xs leading-relaxed text-white/60">
              <Loader2 className="size-3.5 animate-spin text-neon-cyan" />
              Pedido aberto — esperando o código chegar ({contagem(pedido.expiraEm)}).
            </p>
          ) : (
            <p className="font-sans text-xs leading-relaxed text-white/45">
              Nenhum código no momento. Abra o app na sua lista, toque em "Como acessar" e clique em
              "Pedi o código agora" — o código cai aqui em segundos.
            </p>
          )}
        </div>
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
                <button
                  type="button"
                  onClick={() => usar.mutate({ id: c.id })}
                  className="font-sans text-[11px] text-white/35 underline underline-offset-4 transition-colors hover:text-white"
                >
                  já usei este código
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(c.codigo);
                  setCopiado(c.id);
                  setTimeout(() => setCopiado(null), 1800);
                }}
                aria-label="Copiar código"
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

              <Pill accent="cyan" icon={<Timer className="size-3" />}>
                expira em {contagem(c.expiraEm)}
              </Pill>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

export default CodigoRecente;

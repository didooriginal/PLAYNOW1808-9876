// Bloco "Preciso de um código" — pedido, espera e entrega do código do app.
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  contagem,
  useCancelarPedido,
  useMarcarUsado,
  useMeuCodigo,
  usePedirCodigo,
} from "../../queries/codigos";

/**
 * POR QUE ESTE BOTÃO EXISTE.
 *
 * Uma conta matriz atende vários clientes. Se o painel simplesmente mostrasse
 * "o último código que chegou", dois clientes pedindo ao mesmo tempo veriam o
 * código um do outro. Aqui o cliente AVISA que pediu ("Pedi o código agora") e
 * só então o próximo código daquela conta é entregue a ele — por 15 minutos,
 * ou até clicar em "já usei este código".
 */
export function CodigoAcesso({
  slug,
  nome,
  compacto = false,
}: {
  slug: string;
  nome: string;
  /** dentro de modal: sem moldura de card */
  compacto?: boolean;
}) {
  const { data, isPending } = useMeuCodigo();
  const pedir = usePedirCodigo();
  const cancelar = useCancelarPedido();
  const usar = useMarcarUsado();
  const [copiado, setCopiado] = useState(false);
  const [, forcar] = useState(0);

  // relógio de 1s só para a contagem regressiva não travar entre refetches
  useEffect(() => {
    const t = setInterval(() => forcar((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const codigo = data?.codigos?.[0] ?? null;
  const pedido = data?.pedido ?? null;
  // 45s sem nada chegar: o app provavelmente nao reenviou. Sugere o reenvio.
  const demorou = !!pedido && Date.now() - new Date(pedido.criadoEm).getTime() > 45_000;
  const erro = pedir.error ? (pedir.error as Error).message : "";

  const Moldura = ({ children }: { children: React.ReactNode }) =>
    compacto ? (
      <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">{children}</div>
    ) : (
      <GlassCard strong accent="cyan" className="p-5">
        {children}
      </GlassCard>
    );

  return (
    <Moldura>
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-neon-cyan" />
        <span className="font-display text-sm font-bold text-white">
          Código de verificação do {nome}
        </span>
      </div>

      {isPending ? (
        <div className="mt-4 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-neon-cyan" />
          <span className="font-sans text-xs text-white/40">Carregando...</span>
        </div>
      ) : codigo ? (
        /* ---------- CÓDIGO ENTREGUE ---------- */
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label="Copiar código"
              onClick={() => {
                void navigator.clipboard?.writeText(codigo.codigo);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1800);
              }}
              className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/[0.07] px-4 py-2 transition-colors hover:border-neon-cyan/60"
            >
              <span className="font-display text-2xl font-extrabold tracking-[0.22em] text-neon-cyan">
                {codigo.codigo}
              </span>
              {copiado ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4 text-white/40" />
              )}
            </button>
            <Pill accent="cyan" icon={<Timer className="size-3" />}>
              expira em {contagem(codigo.expiraEm)}
            </Pill>
          </div>
          <button
            type="button"
            onClick={() => usar.mutate({ id: codigo.id })}
            className="font-sans text-[11px] text-white/45 underline underline-offset-4 transition-colors hover:text-white"
          >
            já usei este código
          </button>
        </div>
      ) : pedido ? (
        /* ---------- AGUARDANDO O E-MAIL CHEGAR ---------- */
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 animate-spin text-neon-cyan" />
            <span className="font-sans text-xs text-white/70">
              Esperando o código chegar... aparece aqui sozinho, sem recarregar a página.
            </span>
          </div>
          {demorou ? (
            /*
             * PLANO B. Quase todo código já chega resgatado no clique. Se
             * passou deste tempo, é porque o app não mandou e-mail nenhum —
             * normalmente porque o código já tinha sido enviado antes. Aí o
             * caminho é pedir o reenvio no próprio app.
             */
            <p className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 font-sans text-[11px] leading-relaxed text-amber-100/90">
              <RefreshCw className="mt-px size-3.5 shrink-0" />
              <span>
                Ainda nada. Volte no {nome} e toque em <strong>&quot;reenviar código&quot;</strong>{" "}
                — assim que chegar, aparece aqui sozinho.
              </span>
            </p>
          ) : null}
          <p className="font-sans text-[11px] text-white/40">
            Este pedido vale por mais {contagem(pedido.expiraEm)}.
          </p>
          <button
            type="button"
            onClick={() => cancelar.mutate({ id: pedido.id })}
            className="font-sans text-[11px] text-white/45 underline underline-offset-4 transition-colors hover:text-white"
          >
            cancelar pedido
          </button>
        </div>
      ) : (
        /* ---------- SEM PEDIDO ---------- */
        <div className="mt-3 space-y-3">
          <p className="font-sans text-xs leading-relaxed text-white/50">
            Peça o código dentro do aplicativo (a tela do {nome} mostra "enviar código por e-mail")
            e clique no botão abaixo. O código só aparece para quem clicou — é assim que a gente
            garante que você não recebe o código de outra pessoa.
          </p>
          <NeonButton
            onClick={() => pedir.mutate({ servicoSlug: slug })}
            disabled={pedir.isPending}
          >
            {pedir.isPending ? "Abrindo..." : "Pedi o código agora"}
          </NeonButton>
          {erro ? (
            <p className="flex items-start gap-2 font-sans text-[11px] text-red-300">
              <ShieldAlert className="mt-px size-3.5 shrink-0" />
              {erro}
            </p>
          ) : null}
        </div>
      )}
    </Moldura>
  );
}

export default CodigoAcesso;

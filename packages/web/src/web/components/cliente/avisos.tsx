// CENTRAL DE AVISOS DO CLIENTE — sino com a fila de notificacoes automaticas.
import { useState } from "react";
import { Bell, Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { haQuantoTempo, useMarcarLida, useMarcarTodasLidas, useMeusAvisos } from "../../queries/notificacoes";

const ICONE = {
  info: Info,
  alerta: TriangleAlert,
  critico: CircleAlert,
} as const;

const COR = {
  info: "#22d3ee",
  alerta: "#fbbf24",
  critico: "#ff1f3d",
} as const;

type Severidade = keyof typeof COR;

export function AvisosCliente() {
  const [aberto, setAberto] = useState(false);
  const { data } = useMeusAvisos();
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();

  const itens = data?.itens ?? [];
  const naoLidas = data?.naoLidas ?? 0;

  return (
    <div className="relative" data-testid="avisos-cliente">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        data-testid="sino-avisos"
        aria-label="Avisos"
        className="relative flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-neon-cyan/45 hover:text-neon-cyan"
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-neon-red px-1 font-display text-[10px] font-bold text-white"
            data-testid="badge-avisos"
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar avisos"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAberto(false)}
          />
          <div
            className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(92vw,380px)] overflow-y-auto rounded-2xl border border-white/12 bg-[#0b0b0f]/98 p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            data-testid="painel-avisos"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-display text-sm font-bold text-white">Avisos</span>
              <div className="flex items-center gap-1">
                {naoLidas > 0 && (
                  <button
                    type="button"
                    onClick={() => marcarTodas.mutate({ escopo: "cliente" })}
                    className="rounded-lg px-2 py-1 font-sans text-[11px] text-white/45 transition-colors hover:text-neon-cyan"
                  >
                    marcar todas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="flex size-7 items-center justify-center rounded-lg text-white/40 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {itens.length === 0 ? (
              <p className="px-2 py-6 text-center font-sans text-[12px] text-white/35">
                Nenhum aviso por aqui. Tudo em dia.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {itens.map((n) => {
                  const sev = (n.severidade ?? "info") as Severidade;
                  const Icone = ICONE[sev] ?? Info;
                  const cor = COR[sev] ?? COR.info;
                  return (
                    <li key={n.id}>
                      <div
                        className={`flex items-start gap-3 rounded-xl border p-3 ${
                          n.lida ? "border-white/8 bg-white/[0.02]" : "border-white/12 bg-white/[0.05]"
                        }`}
                      >
                        <span
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border"
                          style={{ borderColor: `${cor}55`, background: `${cor}14` }}
                        >
                          <Icone className="size-3.5" style={{ color: cor }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[12.5px] font-bold text-white">
                            {n.titulo}
                          </div>
                          {n.mensagem && (
                            <p className="mt-0.5 font-sans text-[11.5px] leading-relaxed text-white/45">
                              {n.mensagem}
                            </p>
                          )}
                          <span className="mt-1 block font-sans text-[10.5px] text-white/30">
                            {haQuantoTempo(n.criadoEm)}
                          </span>
                        </div>
                        {!n.lida && (
                          <button
                            type="button"
                            onClick={() => marcarLida.mutate({ ids: [n.id] })}
                            aria-label="Marcar como lida"
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-cyan/45 hover:text-neon-cyan"
                          >
                            <Check className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

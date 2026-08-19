// RESUMO DE ENTRADA DO ADMIN - pop-up com tudo que mudou e precisa de acao.
// Abre sozinho quando o admin entra no painel (se a preferencia estiver ligada)
// e pode ser reaberto a qualquer momento pelo botao "Novidades" do cabecalho.
// A preferencia fica no navegador (localStorage), por aparelho.
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Info,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { NeonButton, Pill } from "../ui/kit";
import { Ajuda } from "../ui/tooltip";
import { haQuantoTempo } from "../../queries/notificacoes";

const CHAVE_PREF = "ppn.admin.resumoAoEntrar";

export type ItemResumo = {
  /** id da secao do menu lateral para onde o botao leva */
  destino: string;
  rotulo: string;
  quantidade: number;
  descricao: string;
  severidade: "info" | "alerta" | "critico";
};

export type AlertaResumo = {
  id: number;
  titulo: string;
  mensagem?: string | null;
  severidade?: string | null;
  criadoEm: string | Date;
};

const COR = { info: "#22d3ee", alerta: "#fbbf24", critico: "#ff1f3d" } as const;
const ICONE = { info: Info, alerta: TriangleAlert, critico: CircleAlert } as const;

/** Le a preferencia salva. Padrao: ligado. */
export function resumoLigadoSalvo() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CHAVE_PREF) !== "off";
}

export function salvarResumoLigado(ligado: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE_PREF, ligado ? "on" : "off");
}

export function ResumoEntrada({
  aberto,
  itens,
  alertas,
  ligado,
  onAlternarLigado,
  onFechar,
  onIr,
}: {
  aberto: boolean;
  itens: ItemResumo[];
  alertas: AlertaResumo[];
  ligado: boolean;
  onAlternarLigado: (ligado: boolean) => void;
  onFechar: () => void;
  onIr: (destino: string) => void;
}) {
  // ESC fecha
  useEffect(() => {
    if (!aberto) return;
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const pendencias = itens.filter((i) => i.quantidade > 0);
  const total = pendencias.reduce((s, i) => s + i.quantidade, 0);
  const criticos = pendencias.filter((i) => i.severidade === "critico").length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      data-testid="resumo-entrada"
    >
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/12 bg-[#0b0b0f] p-6 pb-0 shadow-[0_0_80px_-20px_rgba(168,85,247,0.6)] sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)" }}
        />

        <button
          type="button"
          aria-label="Fechar resumo"
          data-testid="resumo-fechar-x"
          onClick={onFechar}
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/30 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="relative flex items-start gap-4 pr-10">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neon-purple/40 bg-neon-purple/10">
            <Sparkles className="size-6 text-neon-purple" />
          </span>
          <div>
            <div className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.24em] text-white/40">
              Resumo de entrada
              <Ajuda ajuda="resumo.popup" />
            </div>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
              {total > 0 ? "O que precisa da sua ação agora" : "Nada pendente por aqui"}
            </h2>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-white/50">
              {total > 0
                ? `${total} ${total === 1 ? "item aguarda" : "itens aguardam"} você${
                    criticos ? ` · ${criticos} em nível crítico` : ""
                  }. Clique em qualquer linha para ir direto ao lugar certo do painel.`
                : "Todas as filas do painel estão zeradas: nenhum código, MAC, TV, chamado ou fatura esperando ação."}
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="relative mt-6 space-y-2.5" data-testid="resumo-pendencias">
            {pendencias.map((item) => {
              const cor = COR[item.severidade];
              const Icone = ICONE[item.severidade];
              return (
                <button
                  key={item.destino}
                  type="button"
                  data-testid={`resumo-ir-${item.destino}`}
                  onClick={() => {
                    onIr(item.destino);
                    onFechar();
                  }}
                  className="group flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
                    style={{ borderColor: `${cor}55`, background: `${cor}14`, color: cor }}
                  >
                    <Icone className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-bold text-white">
                        {item.rotulo}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 font-display text-[11px] font-bold tabular-nums"
                        style={{ background: `${cor}1f`, color: cor }}
                      >
                        {item.quantidade}
                      </span>
                    </span>
                    <span className="mt-0.5 block font-sans text-[12px] leading-relaxed text-white/45">
                      {item.descricao}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </button>
              );
            })}
          </div>
        )}

        {total === 0 && (
          <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.06] p-4">
            <CheckCircle2 className="size-5 shrink-0 text-neon-cyan" />
            <p className="font-sans text-[13px] text-white/60">
              Operação em dia. Você pode fechar este aviso e seguir com o resto.
            </p>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="relative mt-6">
            <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
              <BellRing className="size-3.5" />
              Últimos alertas não lidos
              <Ajuda ajuda="resumo.alertas" />
            </div>
            <div className="mt-2.5 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {alertas.slice(0, 5).map((a) => {
                const sev = (a.severidade ?? "info") as keyof typeof COR;
                const cor = COR[sev] ?? COR.info;
                return (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: cor, boxShadow: `0 0 10px ${cor}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[13px] font-medium text-white/85">{a.titulo}</p>
                      {a.mensagem ? (
                        <p className="mt-0.5 truncate font-sans text-[12px] text-white/40">
                          {a.mensagem}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-sans text-[11px] text-white/30">
                      {haQuantoTempo(a.criadoEm)}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              data-testid="resumo-ir-alertas"
              onClick={() => {
                onIr("alertas");
                onFechar();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 font-sans text-[12px] text-neon-purple hover:underline"
            >
              Abrir a Central de Alertas
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-6 mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#0b0b0f]/95 px-6 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <InterruptorResumo ligado={ligado} onAlternar={onAlternarLigado} />
          <div className="flex items-center gap-2">
            <Pill accent="purple">{ligado ? "Abre no login" : "Só pelo botão"}</Pill>
            <NeonButton
              accent="purple"
              size="sm"
              data-testid="resumo-fechar"
              onClick={onFechar}
            >
              Entendi, fechar
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chave liga/desliga do pop-up. Vale para este navegador/aparelho. */
export function InterruptorResumo({
  ligado,
  onAlternar,
}: {
  ligado: boolean;
  onAlternar: (ligado: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label="Mostrar este resumo quando eu entrar no painel"
        data-testid="resumo-interruptor"
        onClick={() => onAlternar(!ligado)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          ligado
            ? "border-neon-purple/60 bg-neon-purple/30"
            : "border-white/15 bg-white/[0.05]"
        }`}
      >
        <span
          className={`absolute top-[3px] size-4 rounded-full bg-white transition-all ${
            ligado ? "left-[25px] shadow-[0_0_10px_rgba(168,85,247,0.9)]" : "left-[3px] opacity-60"
          }`}
        />
      </button>
      <span className="font-sans text-[12px] leading-tight text-white/55">
        Mostrar este resumo quando eu entrar
        <span className="block text-[11px] text-white/30">
          Desligado, ele só aparece no botão “Novidades” do topo.
        </span>
      </span>
    </label>
  );
}

/** Hook da preferencia: le do localStorage e mantem sincronizado. */
export function usePreferenciaResumo() {
  const [ligado, setLigado] = useState<boolean>(() => resumoLigadoSalvo());
  function alternar(valor: boolean) {
    setLigado(valor);
    salvarResumoLigado(valor);
  }
  return { ligado, alternar };
}

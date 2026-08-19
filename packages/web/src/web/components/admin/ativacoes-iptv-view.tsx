import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  ExternalLink,
  MonitorSmartphone,
  Radio,
  X,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda } from "../ui/tooltip";
import { useFilaIptv, useResponderIptv, dataHoraCurta } from "../../queries/iptv";

/**
 * ATIVACOES DE IPTV — fila do admin.
 *
 * O cliente comprou o plano de canais ao vivo, instalou o Fun Play e mandou o
 * endereco MAC do aparelho. Aqui o admin copia o MAC, cadastra no servidor de
 * IPTV e marca "ativado" — o painel do cliente reage sozinho (polling de 15s)
 * e ele recebe o aviso na hora.
 */

/**
 * Painel do provedor de IPTV: e nele que o MAC do cliente e cadastrado.
 * Fica como botao aqui para a equipe nao precisar guardar o endereco.
 */
const PAINEL_IPTV = "https://searchdefense.top/#/users-iptv";

const ESTILO: Record<string, string> = {
  pendente: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  ativado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  recusado: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  cancelado: "border-white/15 bg-white/5 text-white/40",
};

export function AtivacoesIptvView() {
  const { data, isPending } = useFilaIptv();
  const responder = useResponderIptv();
  const [copiado, setCopiado] = useState<number | null>(null);

  const itens = data?.itens ?? [];
  const pendentes = data?.pendentes ?? 0;

  async function copiar(id: number, valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard bloqueado: ignora */
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Aguardando ativação",
            value: String(pendentes),
            sub: pendentes ? "cliente esperando os canais abrirem" : "fila zerada",
            cor: pendentes ? "#f59e0b" : "#22d3ee",
            ajuda: "iptv.pendentes",
          },
          {
            label: "Aparelhos ativados",
            value: String(data?.ativados ?? 0),
            sub: "MACs já cadastrados no servidor",
            cor: "#34d399",
            ajuda: "iptv.ativados",
          },
          {
            label: "Total de pedidos",
            value: String(itens.length),
            sub: "histórico completo de aparelhos",
            cor: "#a855f7",
            ajuda: "iptv.total",
          },
        ].map((s) => (
          <GlassCard key={s.label} className="p-5" style={{ borderColor: `${s.cor}33` }}>
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                {s.label}
              </span>
              <Ajuda ajuda={s.ajuda} />
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">{s.value}</div>
            <div className="mt-1 font-sans text-[11px]" style={{ color: s.cor }}>
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard strong className="overflow-hidden" style={{ borderColor: "#22d3ee44" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-neon-cyan" />
            <span className="font-display text-sm font-bold text-white">
              Solicitações de ativação de IPTV
            </span>
            <Ajuda ajuda="iptv.fila" />
          </div>
          <div className="flex items-center gap-2">
            {pendentes > 0 && (
              <Pill accent="red" icon={<AlertTriangle className="size-3" />}>
                {pendentes} aguardando
              </Pill>
            )}
            <a
              href={PAINEL_IPTV}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/35 bg-neon-cyan/10 px-3 py-1.5 font-sans text-[11px] font-semibold text-neon-cyan transition hover:bg-neon-cyan/20"
            >
              <ExternalLink className="size-3" />
              Abrir painel IPTV
            </a>
          </div>
        </div>

        {isPending ? (
          <div className="p-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-neon-cyan" />
          </div>
        ) : itens.length === 0 ? (
          <div className="p-10 text-center">
            <MonitorSmartphone className="mx-auto size-6 text-white/20" />
            <p className="mt-3 font-sans text-sm text-white/40">
              Nenhum cliente enviou endereço MAC ainda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {itens.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-semibold text-white">
                    {item.clienteNome ?? "Cliente removido"}
                  </div>
                  <div className="mt-0.5 font-sans text-[11px] text-white/35">
                    {item.clienteEmail ?? "—"}
                    {item.clienteTelefone ? ` · ${item.clienteTelefone}` : ""}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-sm tracking-[0.12em] text-neon-cyan">
                      {item.mac}
                    </span>
                    <button
                      onClick={() => copiar(item.id, item.mac)}
                      aria-label="Copiar endereço MAC"
                      className="rounded-lg p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
                    >
                      {copiado === item.id ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1.5 font-sans text-[11px] text-white/30">
                    {item.dispositivo ? `${item.dispositivo} · ` : ""}
                    enviado em {dataHoraCurta(item.criadoEm)}
                    {item.ativadoEm ? ` · ativado em ${dataHoraCurta(item.ativadoEm)}` : ""}
                  </div>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    ESTILO[item.status] ?? ESTILO.pendente
                  }`}
                >
                  {item.status}
                </span>

                {item.status === "pendente" && (
                  <div className="flex items-center gap-2">
                    <NeonButton
                      accent="cyan"
                      size="sm"
                      disabled={responder.isPending}
                      onClick={() => responder.mutate({ id: item.id, status: "ativado" })}
                    >
                      <Check className="size-3.5" />
                      Marcar como ativado
                    </NeonButton>
                    <NeonButton
                      accent="red"
                      variant="outline"
                      size="sm"
                      disabled={responder.isPending}
                      onClick={() => responder.mutate({ id: item.id, status: "recusado" })}
                    >
                      <X className="size-3.5" />
                      Recusar
                    </NeonButton>
                    {/*
                      Atalho de trabalho: copia o MAC do cliente e ja abre o
                      painel do provedor na tela de usuarios IPTV, e so colar.
                    */}
                    <button
                      type="button"
                      data-testid="iptv-copiar-e-abrir"
                      onClick={() => {
                        void copiar(item.id, item.mac);
                        window.open(PAINEL_IPTV, "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-sans text-[11px] font-semibold text-neon-cyan transition hover:bg-neon-cyan/20"
                    >
                      <ExternalLink className="size-3" />
                      Copiar MAC e abrir painel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

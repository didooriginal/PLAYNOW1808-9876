import { useState } from "react";
import { AlertTriangle, Check, Clock, LifeBuoy, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, accentHex } from "../ui/kit";
import { whatsappLink } from "@/lib/mock-data";
import {
  rotuloStatusChamado,
  rotuloTipo,
  useAtualizarChamado,
  useChamados,
  useResumoSuporte,
} from "../../queries/suporte";

type Chamado = NonNullable<ReturnType<typeof useChamados>["data"]>[number];

const corStatus: Record<string, string> = {
  aberto: "#ff1f3d",
  em_andamento: "#f59e0b",
  resolvido: "#34d399",
};

function ChamadoCard({ chamado }: { chamado: Chamado }) {
  const atualizar = useAtualizarChamado();
  const [resposta, setResposta] = useState(chamado.resposta ?? "");
  const hex = corStatus[chamado.status] ?? "#22d3ee";

  return (
    <GlassCard className="p-4" style={{ borderColor: `${hex}33` }}>
      <div className="flex flex-wrap items-start gap-3">
        {chamado.servico && <AppIcon id={chamado.servico} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold text-white">
              {rotuloTipo(chamado.tipo)}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest"
              style={{ borderColor: `${hex}66`, background: `${hex}14`, color: hex }}
            >
              {rotuloStatusChamado[chamado.status] ?? chamado.status}
            </span>
          </div>
          <div className="mt-0.5 font-sans text-[11px] text-white/40">
            {chamado.clienteNome} · {chamado.clienteEmail}
            {chamado.contaRotulo ? ` · ${chamado.contaRotulo}` : ""}
          </div>
          {chamado.descricao && (
            <p className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 font-sans text-xs text-white/65">
              {chamado.descricao}
            </p>
          )}
        </div>
        <span className="font-sans text-[10px] text-white/25">
          {new Date(chamado.criadoEm).toLocaleString("pt-BR")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Resposta / observação interna"
          className="min-w-48 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none"
        />
        {chamado.status !== "em_andamento" && (
          <NeonButton
            accent="purple"
            variant="outline"
            size="sm"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate({ id: chamado.id, status: "em_andamento", resposta })}
          >
            <Clock className="size-3.5" />
            Em andamento
          </NeonButton>
        )}
        {chamado.status !== "resolvido" && (
          <NeonButton
            accent="cyan"
            size="sm"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate({ id: chamado.id, status: "resolvido", resposta })}
          >
            {atualizar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Resolver
          </NeonButton>
        )}
        <a
          href={whatsappLink(
            `Olá ${chamado.clienteNome}! Sobre o seu chamado "${rotuloTipo(chamado.tipo)}" na PLAPLUSNOW — já estamos resolvendo.`,
          )}
          target="_blank"
          rel="noreferrer"
        >
          <NeonButton accent="red" variant="outline" size="sm">
            <MessageSquare className="size-3.5" />
            WhatsApp
          </NeonButton>
        </a>
      </div>
    </GlassCard>
  );
}

export function SuporteView() {
  const { data, isPending, isError, error } = useChamados();
  const resumo = useResumoSuporte();
  const [filtro, setFiltro] = useState<"pendentes" | "todos" | "resolvidos">("pendentes");

  if (isError)
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <AlertTriangle className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">Erro ao carregar chamados</p>
        <p className="mt-1.5 font-sans text-xs text-white/45">{error?.message}</p>
      </GlassCard>
    );

  const chamados = data ?? [];
  const lista = chamados.filter((c) =>
    filtro === "todos"
      ? true
      : filtro === "resolvidos"
        ? c.status === "resolvido"
        : c.status !== "resolvido",
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Chamados abertos", value: String(resumo.data?.abertos ?? 0), sub: "aguardando resposta", accent: "red" as const },
          { label: "Em andamento", value: String(resumo.data?.emAndamento ?? 0), sub: "sendo resolvidos", accent: "purple" as const },
          { label: "Resolvidos", value: String(resumo.data?.resolvidos ?? 0), sub: "histórico", accent: "cyan" as const },
          { label: "Total", value: String(resumo.data?.total ?? 0), sub: "todos os tempos", accent: "cyan" as const },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">{s.value}</div>
            <div className="mt-1 font-sans text-[11px]" style={{ color: accentHex[s.accent] }}>
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="flex gap-1.5">
        {(["pendentes", "resolvidos", "todos"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-full border px-4 py-2.5 font-sans text-xs capitalize transition-all",
              filtro === f
                ? "border-neon-purple/50 bg-neon-purple/12 text-neon-purple"
                : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isPending ? (
        <GlassCard className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">Carregando chamados...</span>
        </GlassCard>
      ) : lista.length ? (
        <div className="space-y-3">
          {lista.map((c) => (
            <ChamadoCard key={c.id} chamado={c} />
          ))}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <LifeBuoy className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">Nenhum chamado por aqui</p>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Os problemas relatados pelos clientes aparecem nesta fila.
          </p>
        </GlassCard>
      )}
    </div>
  );
}

export default SuporteView;

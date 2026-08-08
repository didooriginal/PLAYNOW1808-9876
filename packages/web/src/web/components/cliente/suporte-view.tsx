import { CheckCircle2, Clock, LifeBuoy, Loader2, TriangleAlert } from "lucide-react";
import { GlassCard } from "../ui/kit";
import { AppIcon } from "../app-icon";
import { RelatarProblema } from "./relatar-problema";
import { rotuloStatusChamado, rotuloTipo, useMeusChamados } from "../../queries/suporte";

const estilo: Record<string, { hex: string; Icon: typeof Clock }> = {
  aberto: { hex: "#ff1f3d", Icon: TriangleAlert },
  em_andamento: { hex: "#f59e0b", Icon: Clock },
  resolvido: { hex: "#34d399", Icon: CheckCircle2 },
};

/** acompanhamento dos chamados abertos pelo cliente */
export function SuporteClienteView() {
  const { data, isPending } = useMeusChamados();
  const chamados = data ?? [];

  return (
    <div className="space-y-5">
      <GlassCard strong accent="purple" className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-display text-sm font-bold text-white">
              Algum app parou de funcionar?
            </div>
            <p className="mt-1 font-sans text-xs text-white/45">
              Abra um chamado e a equipe resolve. Você não precisa fazer mais nada.
            </p>
          </div>
          <RelatarProblema compact />
        </div>
      </GlassCard>

      {isPending ? (
        <GlassCard className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="size-5 animate-spin text-neon-cyan" />
          <span className="font-sans text-sm text-white/45">Carregando seus chamados...</span>
        </GlassCard>
      ) : chamados.length ? (
        <div className="space-y-3">
          {chamados.map((c) => {
            const { hex, Icon } = estilo[c.status] ?? estilo.aberto;
            return (
              <GlassCard key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                {c.servico && <AppIcon id={c.servico} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-white">
                    {rotuloTipo(c.tipo)}
                  </div>
                  <div className="mt-0.5 font-sans text-[11px] text-white/35">
                    aberto em {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                  {c.resposta && (
                    <p className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 font-sans text-xs text-white/65">
                      {c.resposta}
                    </p>
                  )}
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest"
                  style={{ borderColor: `${hex}66`, background: `${hex}14`, color: hex }}
                >
                  <Icon className="size-3" />
                  {rotuloStatusChamado[c.status] ?? c.status}
                </span>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <LifeBuoy className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">Nenhum chamado aberto</p>
          <p className="mt-1.5 font-sans text-xs text-white/40">
            Tudo funcionando por aqui. Se algo falhar, é só relatar.
          </p>
        </GlassCard>
      )}
    </div>
  );
}

export default SuporteClienteView;

import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Gift,
  Loader2,
  Network,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton, Pill, accentHex } from "../ui/kit";
import {
  rotuloPremio,
  useAfiliados,
  useEntregarPremio,
  useMarcarNotificacaoLida,
  useNotificacoesRecompensas,
  useResumoRecompensas,
} from "../../queries/recompensas";

type Afiliado = NonNullable<ReturnType<typeof useAfiliados>["data"]>[number];

/* ------------------------------------------------------------------ */

function KPIs() {
  const { data } = useResumoRecompensas();
  const cards = [
    {
      label: "XP distribuído",
      value: data ? `${data.xpTotal}` : "—",
      sub: `${data?.clientes ?? 0} clientes na jornada`,
      icon: Sparkles,
      accent: "purple" as const,
    },
    {
      label: "Indicações convertidas",
      value: data ? String(data.indicacoesConvertidas) : "—",
      sub: `${data?.comIndicacao ?? 0} afiliados ativos`,
      icon: Network,
      accent: "cyan" as const,
    },
    {
      label: "Cupons 15% OFF ativos",
      value: data ? String(data.cupons) : "—",
      sub: "aplicados na próxima fatura",
      icon: Gift,
      accent: "red" as const,
    },
    {
      label: "Avisos pendentes",
      value: data ? String(data.avisosPendentes) : "—",
      sub: "marcos que precisam de ação",
      icon: Bell,
      accent: "purple" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <GlassCard key={c.label} accent={c.accent} className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {c.label}
            </span>
            <c.icon className="size-4" style={{ color: accentHex[c.accent] }} />
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold text-white">{c.value}</div>
          <div className="mt-1 font-sans text-[11px] text-white/35">{c.sub}</div>
        </GlassCard>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Avisos() {
  const { data } = useNotificacoesRecompensas();
  const marcar = useMarcarNotificacaoLida();
  const pendentes = (data ?? []).filter((n) => !n.lidoPeloAdmin);

  if (pendentes.length === 0) return null;

  return (
    <GlassCard accent="red" className="p-5">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-neon-red" />
        <h3 className="font-display text-sm font-bold text-white">
          Marcos que precisam da sua ação
        </h3>
      </div>
      <div className="mt-4 space-y-2">
        {pendentes.map((n) => (
          <div
            key={n.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-neon-red/25 bg-neon-red/[0.06] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="font-sans text-xs font-semibold text-white">{n.clienteNome}</div>
              <div className="font-sans text-[11px] text-white/45">{n.descricao}</div>
            </div>
            <span className="font-sans text-[10px] text-white/25">
              {new Date(n.criadoEm).toLocaleDateString("pt-BR")}
            </span>
            <NeonButton
              accent="cyan"
              variant="outline"
              size="sm"
              type="button"
              disabled={marcar.isPending}
              onClick={() => marcar.mutate({ id: n.id })}
            >
              <Check className="size-3.5" />
              Resolvido
            </NeonButton>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function LinhaAfiliado({ afiliado }: { afiliado: Afiliado }) {
  const entregar = useEntregarPremio();
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/signup?ref=${afiliado.codigo}`)
      .catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025]">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border font-display text-xs font-bold"
        style={{
          borderColor: `${accentHex.purple}55`,
          background: `${accentHex.purple}14`,
          color: accentHex.purple,
        }}
      >
        {afiliado.nivel}
      </span>

      <div className="min-w-[180px] flex-1">
        <div className="font-display text-sm font-semibold text-white">{afiliado.nome}</div>
        <div className="font-sans text-[11px] text-white/35">{afiliado.email}</div>
      </div>

      <div className="w-36">
        <div className="font-sans text-[10px] uppercase tracking-widest text-white/25">Código</div>
        <button
          type="button"
          onClick={copiar}
          className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-neon-purple hover:text-white"
        >
          {afiliado.codigo || "—"}
          {copiado ? <Check className="size-3" /> : <Copy className="size-3 opacity-50" />}
        </button>
      </div>

      <div className="w-40">
        <div className="font-sans text-[10px] uppercase tracking-widest text-white/25">
          Indicado por
        </div>
        <div className="mt-0.5 font-sans text-xs text-white/60">
          {afiliado.indicadoPorNome ?? "—"}
        </div>
      </div>

      <div className="w-24 text-center">
        <div className="font-sans text-[10px] uppercase tracking-widest text-white/25">
          Indicações
        </div>
        <div className="font-display text-sm font-bold text-white">
          {afiliado.indicacoesAssinantes}
          <span className="font-sans text-[11px] text-white/30">/{afiliado.indicacoes}</span>
        </div>
      </div>

      <div className="w-24 text-center">
        <div className="font-sans text-[10px] uppercase tracking-widest text-white/25">
          Renovações
        </div>
        <div className="font-display text-sm font-bold text-white">{afiliado.renovacoes}</div>
      </div>

      <div className="w-28 text-center">
        <div className="font-sans text-[10px] uppercase tracking-widest text-white/25">XP</div>
        <div className="font-display text-sm font-bold text-neon-cyan">{afiliado.xp}</div>
        <div className="font-sans text-[10px] text-white/30">{afiliado.nivelTitulo}</div>
      </div>

      <div className="flex min-w-[220px] flex-1 flex-wrap justify-end gap-1.5">
        {afiliado.premiosLiberados.length === 0 && (
          <span className="font-sans text-[11px] text-white/25">nenhum prêmio liberado</span>
        )}
        {afiliado.premiosLiberados.map((p) => {
          const entregue = afiliado.premiosEntregues.includes(p);
          return (
            <button
              key={p}
              type="button"
              disabled={entregar.isPending}
              onClick={() => entregar.mutate({ clienteId: afiliado.clienteId, premio: p })}
              title={entregue ? "Marcar como pendente" : "Marcar como entregue"}
              className={cn(
                "rounded-full border px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest transition-colors",
                entregue
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:border-emerald-400/40 hover:text-emerald-300",
              )}
            >
              {entregue ? "✓ " : ""}
              {rotuloPremio(p)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AfiliadosView() {
  const { data, isPending, isError, error } = useAfiliados();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return data ?? [];
    return (data ?? []).filter(
      (a) =>
        a.nome.toLowerCase().includes(termo) ||
        a.email.toLowerCase().includes(termo) ||
        a.codigo.toLowerCase().includes(termo) ||
        (a.indicadoPorNome ?? "").toLowerCase().includes(termo),
    );
  }, [data, busca]);

  if (isPending) {
    return (
      <GlassCard className="flex items-center justify-center gap-3 p-12">
        <Loader2 className="size-5 animate-spin text-neon-purple" />
        <span className="font-sans text-sm text-white/45">Calculando pontuação dos clientes...</span>
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <p className="font-sans text-sm text-white/50">{error?.message}</p>
      </GlassCard>
    );
  }

  const topo = (data ?? []).slice(0, 3);

  return (
    <div className="space-y-5">
      <KPIs />
      <Avisos />

      {topo.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {topo.map((a, i) => (
            <GlassCard
              key={a.clienteId}
              accent={i === 0 ? "purple" : i === 1 ? "cyan" : "red"}
              className="relative overflow-hidden p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05]">
                  <Trophy
                    className="size-5"
                    style={{ color: accentHex[i === 0 ? "purple" : i === 1 ? "cyan" : "red"] }}
                  />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold text-white">{a.nome}</div>
                  <div className="font-sans text-[11px] text-white/35">
                    {a.nivelTitulo} · nível {a.nivel}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-2xl font-extrabold text-white">{a.xp}</span>
                <span className="font-sans text-[11px] uppercase tracking-widest text-white/35">
                  XP
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill accent="cyan">{a.indicacoesAssinantes} indicações</Pill>
                <Pill accent="red">{a.renovacoes} renovações</Pill>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-neon-purple" />
            <div className="font-display text-sm font-bold text-white">
              Quem indicou quem · pontos · prêmios
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou código"
              className="h-9 w-56 rounded-full border border-white/10 bg-white/[0.04] pl-9 pr-3 font-sans text-xs text-white outline-none placeholder:text-white/25 focus:border-neon-purple/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px] divide-y divide-white/6">
            {filtrados.map((a) => (
              <LinhaAfiliado key={a.clienteId} afiliado={a} />
            ))}
            {filtrados.length === 0 && (
              <div className="px-5 py-10 text-center font-sans text-sm text-white/35">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

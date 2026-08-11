import { useState } from "react";
import {
  BadgePercent,
  CalendarCheck,
  CalendarCheck2,
  Check,
  Copy,
  Crown,
  Gem,
  Gift,
  Loader2,
  Lock,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, NeonButton, Pill, accentHex } from "../ui/kit";
import { whatsappLink } from "@/lib/mock-data";
import { useMinhaJornada, rotuloPremio } from "../../queries/recompensas";

type Accent = "red" | "cyan" | "purple";

const ICONES = {
  calendario: CalendarCheck,
  calendario2: CalendarCheck2,
  desconto: BadgePercent,
  indicacao: UserPlus,
  grupo: Users,
  coroa: Crown,
  diamante: Gem,
} as const;

/* ------------------------------------------------------------------ */
/* CARD DE MISSÃO                                                      */
/* ------------------------------------------------------------------ */

function MissaoCard({
  missao,
}: {
  missao: {
    id: string;
    ordem: number;
    titulo: string;
    recompensa: string;
    icone: keyof typeof ICONES;
    accent: Accent;
    alvo: number;
    progresso: number;
    concluida: boolean;
  };
}) {
  const Icon = ICONES[missao.icone] ?? Sparkles;
  const hex = accentHex[missao.accent];
  const pct = Math.round((missao.progresso / missao.alvo) * 100);

  return (
    <div
      className={cn(
        "relative flex w-[152px] shrink-0 flex-col items-center rounded-2xl border p-4 text-center transition-all duration-300 xl:w-auto xl:flex-1",
        missao.concluida
          ? "border-white/12 bg-white/[0.05]"
          : "border-white/8 bg-white/[0.02] hover:border-white/15",
      )}
      style={
        missao.concluida
          ? { boxShadow: `0 0 0 1px ${hex}33, 0 18px 44px -28px ${hex}` }
          : undefined
      }
    >
      {missao.concluida && (
        <span
          className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full"
          style={{ background: `${hex}22`, border: `1px solid ${hex}66` }}
        >
          <Check className="size-3" style={{ color: hex }} />
        </span>
      )}

      <div className="min-h-[34px] font-sans text-[12px] font-semibold leading-snug text-white/85">
        {missao.titulo}
      </div>

      <div
        className={cn(
          "mt-3 flex size-14 items-center justify-center rounded-2xl border transition-all",
          !missao.concluida && "opacity-45 grayscale",
        )}
        style={{
          borderColor: `${hex}55`,
          background: `linear-gradient(150deg, ${hex}26 0%, ${hex}08 100%)`,
          boxShadow: missao.concluida ? `0 0 26px -8px ${hex}` : undefined,
        }}
      >
        <Icon className="size-7" style={{ color: hex }} strokeWidth={1.9} />
      </div>

      <div
        className="mt-3 font-display text-[12px] font-extrabold uppercase leading-tight tracking-wide"
        style={{ color: missao.concluida ? hex : "rgba(255,255,255,0.35)" }}
      >
        {missao.recompensa}
      </div>

      {!missao.concluida && (
        <div className="mt-2 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: hex }}
            />
          </div>
          <div className="mt-1 font-mono text-[10px] text-white/30">
            {missao.progresso}/{missao.alvo}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LINK DE INDICAÇÃO                                                   */
/* ------------------------------------------------------------------ */

function LinkIndicacao({
  codigo,
  indicados,
}: {
  codigo: string;
  indicados: { nome: string; email: string; assinante: boolean; statusPagamento: string }[];
}) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/signup?ref=${codigo}`;

  function copiar() {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  const convite = `Fala! Eu uso a PLAYPLUSNOW pra assinar todos os meus streamings por um preço só. Se você entrar pelo meu link a gente ganha vantagem: ${link}`;

  return (
    <GlassCard accent="purple" className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)" }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Pill accent="purple" icon={<Share2 className="size-3" />}>
              Indique e ganhe
            </Pill>
            <h3 className="mt-3 font-display text-lg font-bold text-white">
              Seu link de indicação
            </h3>
            <p className="mt-1 font-sans text-xs text-white/45">
              Cada amigo que assinar pelo seu link vale{" "}
              <span className="font-semibold text-neon-purple">+150 XP</span>. Com 3 indicações você
              destrava 1 mês de HBO Max grátis.
            </p>
          </div>
          <div className="rounded-2xl border border-neon-purple/35 bg-neon-purple/10 px-4 py-3 text-center">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
              Seu código
            </div>
            <div className="mt-1 font-mono text-lg font-bold tracking-widest text-neon-purple">
              {codigo || "—"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/60">{link}</span>
          <NeonButton accent="purple" size="sm" variant="outline" onClick={copiar} type="button">
            {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </NeonButton>
          <a href={whatsappLink(convite)} target="_blank" rel="noreferrer">
            <NeonButton accent="purple" size="sm" type="button">
              Compartilhar
            </NeonButton>
          </a>
        </div>

        {indicados.length > 0 && (
          <div className="mt-5">
            <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
              Pessoas que entraram pelo seu link
            </div>
            <div className="mt-3 space-y-2">
              {indicados.map((i) => (
                <div
                  key={i.email}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-display text-[11px] font-bold text-white/60">
                    {i.nome.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-sans text-xs text-white/70">
                    {i.nome}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-widest",
                      i.assinante
                        ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/35 bg-amber-400/10 text-amber-300",
                    )}
                  >
                    {i.assinante ? "assinante" : "pendente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/* JORNADA                                                             */
/* ------------------------------------------------------------------ */

export function JornadaCliente() {
  const { data, isPending, isError, error } = useMinhaJornada();

  if (isPending) {
    return (
      <GlassCard className="flex items-center justify-center gap-3 p-12">
        <Loader2 className="size-5 animate-spin text-neon-purple" />
        <span className="font-sans text-sm text-white/45">Calculando sua jornada...</span>
      </GlassCard>
    );
  }

  if (isError || !data) {
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <p className="font-sans text-sm text-white/50">
          {error?.message ?? "Não foi possível carregar a sua jornada."}
        </p>
      </GlassCard>
    );
  }

  const { progresso, missoes, nivelTitulo, xpNoNivel, xpParaProximo, xpPorNivel, codigo, indicados } =
    data;

  const concluidas = missoes.filter((m) => m.concluida).length;
  const premios = progresso.premiosLiberados ?? [];

  return (
    <div className="space-y-5">
      {/* nível + XP */}
      <GlassCard strong accent="purple" className="relative overflow-hidden p-6 sm:p-7">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div
              className="relative flex size-20 shrink-0 items-center justify-center rounded-3xl border border-neon-purple/45"
              style={{
                background: "linear-gradient(150deg, rgba(168,85,247,0.3) 0%, rgba(34,211,238,0.12) 100%)",
                boxShadow: "0 0 40px -12px #a855f7",
              }}
            >
              <Trophy className="size-8 text-neon-purple" strokeWidth={1.8} />
              <span className="absolute -bottom-2 rounded-full border border-neon-purple/50 bg-ink px-2 py-0.5 font-display text-[10px] font-bold text-neon-purple">
                NÍVEL {progresso.nivel}
              </span>
            </div>
            <div>
              <div className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/40">
                Jornada do cliente
              </div>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
                {nivelTitulo}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill accent="purple">{progresso.xp} XP</Pill>
                <Pill accent="cyan">
                  {concluidas}/{missoes.length} missões
                </Pill>
                <Pill accent="red">{progresso.mesesAtivo} meses de casa</Pill>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:w-80">
            <div className="flex items-baseline justify-between">
              <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/40">
                Próximo nível
              </span>
              <span className="font-display text-sm font-bold text-neon-purple">
                faltam {xpParaProximo} XP
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((xpNoNivel / xpPorNivel) * 100)}%`,
                  background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 100%)",
                  boxShadow: "0 0 18px -2px #a855f7",
                }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-white/30">
              <span>{xpNoNivel} XP</span>
              <span>{xpPorNivel} XP</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/30">
                  Renovações
                </div>
                <div className="font-display text-lg font-bold text-white">
                  {progresso.renovacoes}
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/30">
                  Indicações
                </div>
                <div className="font-display text-lg font-bold text-white">
                  {progresso.indicacoesAssinantes}
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* trilha de missões — estilo da referência */}
      <GlassCard className="overflow-hidden p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-neon-purple" />
          <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-neon-cyan">
            Missões e recompensas
          </h3>
        </div>

        <div className="-mx-1 mt-5 overflow-x-auto pb-2">
          <div className="min-w-[1120px] px-1 xl:min-w-0">
            <div className="flex items-stretch gap-3">
              {missoes.map((m) => (
                <MissaoCard key={m.id} missao={m as never} />
              ))}
            </div>

            {/* linha numerada 1..7 */}
            <div className="relative mt-5 flex items-center">
              {missoes.map((m, i) => (
                <div
                  key={m.id}
                  className={cn("flex items-center", i < missoes.length - 1 && "flex-1")}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold transition-all",
                      m.concluida ? "text-white" : "border-white/15 bg-white/5 text-white/35",
                    )}
                    style={
                      m.concluida
                        ? {
                            borderColor: accentHex[m.accent as Accent],
                            background: accentHex[m.accent as Accent],
                            boxShadow: `0 0 20px -4px ${accentHex[m.accent as Accent]}`,
                          }
                        : undefined
                    }
                  >
                    {m.ordem}
                  </span>
                  {i < missoes.length - 1 && (
                    <span
                      className="h-px w-full min-w-[60px] flex-1"
                      style={{
                        background: m.concluida
                          ? "linear-gradient(90deg, #22d3ee, #a855f7)"
                          : "rgba(255,255,255,0.12)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 font-sans text-[11px] text-white/35">
          O progresso é calculado automaticamente: cada renovação em dia vale +50 XP e cada
          indicação que vira assinante vale +150 XP.
        </p>
      </GlassCard>

      {/* prêmios */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <LinkIndicacao codigo={codigo} indicados={indicados} />

        <GlassCard accent="cyan" className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-neon-cyan" />
            <h3 className="font-display text-sm font-bold text-white">Prêmios desbloqueados</h3>
          </div>

          {progresso.cupomAtivo ? (
            <div className="mt-4 rounded-2xl border border-neon-red/40 bg-neon-red/[0.08] p-4">
              <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/40">
                Cupom ativo na próxima fatura
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-xl font-bold tracking-widest text-neon-red">
                  {progresso.cupomAtivo}
                </span>
                <span className="font-display text-sm font-bold text-white">
                  -{progresso.cupomDesconto}%
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {missoes
              .filter((m) => m.premio)
              .map((m) => {
                const liberado = premios.includes(m.premio);
                const entregue = (progresso.premiosEntregues ?? []).includes(m.premio);
                return (
                  <div
                    key={m.premio}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      liberado
                        ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                        : "border-white/8 bg-white/[0.02]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border",
                        liberado
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-white/25",
                      )}
                    >
                      {liberado ? <Check className="size-4" /> : <Lock className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate font-sans text-xs font-semibold",
                          liberado ? "text-white" : "text-white/45",
                        )}
                      >
                        {rotuloPremio(m.premio)}
                      </div>
                      <div className="font-sans text-[10px] text-white/30">{m.titulo}</div>
                    </div>
                    {entregue && (
                      <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-sans text-[10px] uppercase tracking-widest text-emerald-300">
                        entregue
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          <p className="mt-4 font-sans text-[11px] text-white/35">
            Prêmios liberados são entregues pela equipe. Fale no WhatsApp para resgatar.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

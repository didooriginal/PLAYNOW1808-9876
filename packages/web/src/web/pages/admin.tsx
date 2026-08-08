import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Copy,
  Database,
  Layers,
  LayoutDashboard,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../components/app-icon";
import { PanelShell, type NavItem } from "../components/panel-shell";
import {
  GlassCard,
  NeonBackdrop,
  NeonButton,
  Pill,
  ProgressBar,
  accentHex,
} from "../components/ui/kit";
import {
  brl,
  revenueSeries,
  serviceById,
  services,
  whatsappLink,
  type Accent,
  type ServiceId,
} from "@/lib/mock-data";
import {
  useAjustarVagas,
  useContas,
  useCriarConta,
  useRemoverConta,
  useReporConta,
  useResumoEstoque,
} from "../queries/contas";
import { usePacotes, useCriarPacote, useRemoverPacote } from "../queries/pacotes";
import {
  useCriarUsuario,
  useRemoverUsuario,
  useResumoClientes,
  useUsuarios,
} from "../queries/usuarios";
import { useRodarSeed, useSeedStatus } from "../queries/seed";

type Conta = NonNullable<ReturnType<typeof useContas>["data"]>[number];
type Cliente = NonNullable<ReturnType<typeof useUsuarios>["data"]>[number];
type Pacote = NonNullable<ReturnType<typeof usePacotes>["data"]>[number];

/* ------------------------------------------------------------------ */

function Loading({ label = "Carregando dados do banco..." }: { label?: string }) {
  return (
    <GlassCard className="flex items-center justify-center gap-3 p-12">
      <Loader2 className="size-5 animate-spin text-neon-cyan" />
      <span className="font-sans text-sm text-white/45">{label}</span>
    </GlassCard>
  );
}

function ErrorBox({ message }: { message?: string }) {
  return (
    <GlassCard accent="red" className="p-8 text-center">
      <AlertTriangle className="mx-auto size-6 text-neon-red" />
      <p className="mt-3 font-display text-sm font-bold text-white">Erro ao consultar o banco</p>
      <p className="mt-1.5 font-sans text-xs text-white/45">{message ?? "Tente novamente."}</p>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function SeedBanner() {
  const { data: status } = useSeedStatus();
  const seed = useRodarSeed();
  const vazio = status && status.pacotes === 0 && status.contas === 0 && status.usuarios === 0;
  if (!vazio) return null;

  return (
    <GlassCard strong accent="cyan" className="flex flex-wrap items-center gap-4 p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan">
        <Database className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-bold text-white">Banco vazio</div>
        <p className="mt-0.5 font-sans text-xs text-white/45">
          Popule as tabelas <span className="font-mono">pacotes</span>,{" "}
          <span className="font-mono">contas_matrizes</span> e{" "}
          <span className="font-mono">usuarios</span> com o catálogo inicial.
        </p>
      </div>
      <NeonButton
        accent="cyan"
        size="sm"
        onClick={() => seed.mutate({ force: false })}
        disabled={seed.isPending}
      >
        {seed.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
        Popular banco
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function StatCards() {
  const clientes = useResumoClientes();
  const estoque = useResumoEstoque();

  const cards = [
    {
      label: "Clientes ativos",
      value: clientes.data ? String(clientes.data.ativos) : "—",
      delta: clientes.data ? `${clientes.data.total} cadastrados no total` : "carregando",
      accent: "cyan" as Accent,
      Icon: Users,
    },
    {
      label: "Faturas a vencer",
      value: clientes.data ? String(clientes.data.vencendo) : "—",
      delta: clientes.data ? `${brl(clientes.data.emAtraso)} em atraso` : "carregando",
      accent: "purple" as Accent,
      Icon: Receipt,
    },
    {
      label: "Receita mensal (MRR)",
      value: clientes.data ? brl(clientes.data.mrr) : "—",
      delta: estoque.data ? `custo de matrizes ${brl(estoque.data.custoMensal)}` : "carregando",
      accent: "cyan" as Accent,
      Icon: TrendingUp,
    },
    {
      label: "Contas esgotadas",
      value: estoque.data ? String(estoque.data.esgotadas) : "—",
      delta: estoque.data
        ? `${estoque.data.vagasOcupadas}/${estoque.data.vagasTotais} vagas ocupadas`
        : "carregando",
      accent: "red" as Accent,
      Icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((s, i) => {
        const hex = accentHex[s.accent];
        return (
          <GlassCard
            key={s.label}
            accent={s.accent}
            hover
            className="animate-rise relative overflow-hidden p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div
              className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl"
              style={{ background: `radial-gradient(circle, ${hex}33 0%, transparent 70%)` }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                  {s.label}
                </div>
                <div className="mt-2 font-display text-3xl font-extrabold text-white">{s.value}</div>
                <div className="mt-1.5 font-sans text-[11px]" style={{ color: hex }}>
                  {s.delta}
                </div>
              </div>
              <span
                className="flex size-10 items-center justify-center rounded-2xl border"
                style={{ borderColor: `${hex}44`, background: `${hex}14`, color: hex }}
              >
                <s.Icon className="size-5" />
              </span>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MasterAccountCard({ acc }: { acc: Conta }) {
  const service = serviceById(acc.servico as ServiceId);
  const pct = Math.round((acc.vagasOcupadas / acc.totalVagas) * 100);
  const full = acc.vagasOcupadas >= acc.totalVagas;
  const nearly = !full && pct >= 75;

  const alocar = useAjustarVagas();
  const repor = useReporConta();
  const remover = useRemoverConta();
  const busy = alocar.isPending || repor.isPending || remover.isPending;

  return (
    <GlassCard
      hover
      className="relative flex flex-col overflow-hidden p-5"
      style={
        full
          ? {
              borderColor: "rgba(255,31,61,0.45)",
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(255,31,61,0.15), 0 0 34px -8px rgba(255,31,61,0.5)",
            }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 size-36 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${full ? "rgba(255,31,61,0.3)" : `${service.color}2b`} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon id={acc.servico as ServiceId} size="sm" active={!full} />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-white">{acc.rotulo}</div>
            <div className="truncate font-mono text-[10px] text-white/30">{acc.email}</div>
          </div>
        </div>
        {full ? (
          <span
            className="shrink-0 rounded-full border border-neon-red/50 bg-neon-red/15 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-neon-red"
            style={{ boxShadow: "0 0 20px -6px #ff1f3d" }}
          >
            Esgotado
          </span>
        ) : nearly ? (
          <span className="shrink-0 rounded-full border border-amber-400/45 bg-amber-400/12 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Quase cheio
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Disponível
          </span>
        )}
      </div>

      {/* lotação */}
      <div className="relative mt-5">
        <div className="flex items-end justify-between">
          <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
            Lotação
          </span>
          <span
            className="font-display text-lg font-extrabold"
            style={{ color: full ? "#ff1f3d" : nearly ? "#f59e0b" : "#22d3ee" }}
          >
            {acc.vagasOcupadas}/{acc.totalVagas}
            <span className="ml-1.5 font-sans text-[11px] font-medium text-white/35">
              vagas ocupadas
            </span>
          </span>
        </div>
        <ProgressBar value={acc.vagasOcupadas} max={acc.totalVagas} className="mt-2.5" />
        <div className="mt-2 flex items-center justify-between font-sans text-[11px] text-white/30">
          <span>{pct}% de ocupação</span>
          <span>
            {full ? "0 vagas livres" : `${acc.totalVagas - acc.vagasOcupadas} vaga(s) livre(s)`}
          </span>
        </div>
      </div>

      {/* meta */}
      <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/8 pt-4">
        {[
          { label: "Renovação", value: acc.renovacao || "—" },
          { label: "Custo", value: brl(acc.custo) },
          { label: "Região", value: acc.regiao },
        ].map((m) => (
          <div key={m.label}>
            <div className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/25">
              {m.label}
            </div>
            <div className="mt-0.5 truncate font-display text-xs font-bold text-white/80">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-4 flex gap-2">
        {full ? (
          <NeonButton
            accent="red"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => repor.mutate({ id: acc.id })}
          >
            {repor.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Repor conta
          </NeonButton>
        ) : (
          <NeonButton
            accent="cyan"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => alocar.mutate({ id: acc.id, delta: 1 })}
          >
            {alocar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            Alocar cliente
          </NeonButton>
        )}
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-white/25 hover:text-white"
          aria-label="Copiar login"
          onClick={() => navigator.clipboard?.writeText(`${acc.email} · ${acc.senha}`).catch(() => {})}
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
          aria-label="Excluir conta matriz"
          disabled={busy}
          onClick={() => remover.mutate({ id: acc.id })}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function NovaContaForm({ onClose }: { onClose: () => void }) {
  const criar = useCriarConta();
  const [form, setForm] = useState({
    servico: "netflix",
    rotulo: "",
    email: "",
    senha: "",
    totalVagas: 5,
    renovacao: "",
    custo: 0,
    regiao: "BR",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-sm font-bold text-white">Nova conta matriz</div>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-xs text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={form.servico}
          onChange={(e) => set("servico", e.target.value)}
          className={input}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#09090b]">
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={input}
          placeholder="Rótulo (ex.: Netflix — Matriz 09)"
          value={form.rotulo}
          onChange={(e) => set("rotulo", e.target.value)}
        />
        <input
          className={input}
          placeholder="E-mail do streaming"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <input
          className={input}
          placeholder="Senha"
          value={form.senha}
          onChange={(e) => set("senha", e.target.value)}
        />
        <input
          className={input}
          type="number"
          min={1}
          placeholder="Total de vagas"
          value={form.totalVagas}
          onChange={(e) => set("totalVagas", Number(e.target.value))}
        />
        <input
          className={input}
          placeholder="Renovação (dd/mm/aaaa)"
          value={form.renovacao}
          onChange={(e) => set("renovacao", e.target.value)}
        />
        <input
          className={input}
          type="number"
          step="0.01"
          placeholder="Custo mensal"
          value={form.custo}
          onChange={(e) => set("custo", Number(e.target.value))}
        />
        <input
          className={input}
          placeholder="Região"
          value={form.regiao}
          onChange={(e) => set("regiao", e.target.value)}
        />
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">{criar.error?.message}</p>
      )}

      <NeonButton
        accent="purple"
        size="sm"
        className="mt-4"
        disabled={criar.isPending || !form.rotulo || !form.email || !form.senha}
        onClick={() =>
          criar.mutate(
            {
              ...form,
              rotulo: form.rotulo || `${serviceById(form.servico as ServiceId).name} — Matriz`,
              vagasOcupadas: 0,
              status: "ativo",
            },
            { onSuccess: onClose },
          )
        }
      >
        {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Salvar no banco
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function StockView() {
  const { data: contas, isPending, isError, error } = useContas();
  const resumo = useResumoEstoque();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todas" | "esgotadas" | "livres">("todas");
  const [criando, setCriando] = useState(false);

  const filtered = useMemo(() => {
    return (contas ?? []).filter((a) => {
      const q = query.toLowerCase();
      const matchesQuery =
        a.rotulo.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      const full = a.vagasOcupadas >= a.totalVagas;
      const matchesFilter = filter === "todas" ? true : filter === "esgotadas" ? full : !full;
      return matchesQuery && matchesFilter;
    });
  }, [contas, query, filter]);

  if (isError) return <ErrorBox message={error?.message} />;

  const totalSlots = resumo.data?.vagasTotais ?? 0;
  const usedSlots = resumo.data?.vagasOcupadas ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Contas matrizes",
            value: String(resumo.data?.contas ?? 0),
            sub: `${totalSlots} vagas totais`,
            accent: "cyan" as const,
          },
          {
            label: "Vagas ocupadas",
            value: `${usedSlots}/${totalSlots}`,
            sub: totalSlots ? `${Math.round((usedSlots / totalSlots) * 100)}% de ocupação` : "—",
            accent: "purple" as const,
          },
          {
            label: "Contas esgotadas",
            value: String(resumo.data?.esgotadas ?? 0),
            sub: "reposição recomendada",
            accent: "red" as const,
          },
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="glass flex h-11 min-w-56 flex-1 items-center gap-2 rounded-full px-4">
          <Search className="size-4 shrink-0 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conta matriz ou login..."
            className="w-full bg-transparent font-sans text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {(["todas", "esgotadas", "livres"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-4 py-2.5 font-sans text-xs capitalize transition-all",
                filter === f
                  ? "border-neon-purple/50 bg-neon-purple/12 text-neon-purple"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <NeonButton accent="purple" size="md" onClick={() => setCriando((v) => !v)}>
          <Plus className="size-4" />
          Nova matriz
        </NeonButton>
      </div>

      {criando && <NovaContaForm onClose={() => setCriando(false)} />}

      {isPending ? (
        <Loading label="Carregando estoque..." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((acc) => (
              <MasterAccountCard key={acc.id} acc={acc} />
            ))}
          </div>

          {filtered.length === 0 && (
            <GlassCard className="p-10 text-center">
              <Boxes className="mx-auto size-6 text-white/20" />
              <p className="mt-3 font-sans text-sm text-white/40">Nenhuma conta encontrada.</p>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PackagesView() {
  const { data: pacotes, isPending, isError, error } = usePacotes();
  const criar = useCriarPacote();
  const remover = useRemoverPacote();
  const [form, setForm] = useState({
    nome: "",
    tagline: "",
    preco: 0,
    precoAnual: 0,
    vagasRestantes: 10,
    perks: "",
    destaque: false,
    servicos: [] as string[],
  });

  const limparForm = () =>
    setForm({
      nome: "",
      tagline: "",
      preco: 0,
      precoAnual: 0,
      vagasRestantes: 10,
      perks: "",
      destaque: false,
      servicos: [],
    });

  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      servicos: f.servicos.includes(id)
        ? f.servicos.filter((s) => s !== id)
        : [...f.servicos, id],
    }));

  if (isError) return <ErrorBox message={error?.message} />;

  return (
    <div className="space-y-5">
      <GlassCard strong accent="purple" className="p-5">
        <div className="font-display text-sm font-bold text-white">Novo pacote</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <input
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Nome do combo"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            value={form.preco}
            onChange={(e) => setForm((f) => ({ ...f, preco: Number(e.target.value) }))}
            placeholder="Preço mensal"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <input
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Tagline (aparece no card da landing)"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            value={form.precoAnual}
            onChange={(e) => setForm((f) => ({ ...f, precoAnual: Number(e.target.value) }))}
            placeholder="Preço anual /mês"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <input
            value={form.perks}
            onChange={(e) => setForm((f) => ({ ...f, perks: e.target.value }))}
            placeholder="Benefícios separados por vírgula"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
          <input
            type="number"
            value={form.vagasRestantes}
            onChange={(e) => setForm((f) => ({ ...f, vagasRestantes: Number(e.target.value) }))}
            placeholder="Vagas restantes"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
        </div>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 font-sans text-xs text-white/50">
          <input
            type="checkbox"
            checked={form.destaque}
            onChange={(e) => setForm((f) => ({ ...f, destaque: e.target.checked }))}
            className="size-4 accent-[#ff1f3d]"
          />
          Pacote em destaque (usado no hero e no comparativo da landing)
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {services.map((s) => {
            const on = form.servicos.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-2 font-sans text-xs transition-all",
                  on
                    ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white",
                )}
              >
                <AppIcon id={s.id} size="xs" active={on} />
                {s.name}
              </button>
            );
          })}
        </div>

        {criar.isError && (
          <p className="mt-3 font-sans text-xs text-neon-red">{criar.error?.message}</p>
        )}

        <NeonButton
          accent="purple"
          size="sm"
          className="mt-4"
          disabled={criar.isPending || !form.nome || form.servicos.length === 0}
          onClick={() =>
            criar.mutate(
              {
                nome: form.nome,
                tagline: form.tagline,
                preco: form.preco,
                precoAnual: form.precoAnual > 0 ? form.precoAnual : null,
                servicos: form.servicos,
                perks: form.perks
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                accent: form.destaque ? "red" : "cyan",
                destaque: form.destaque,
                vagasRestantes: form.vagasRestantes,
                ativo: true,
              },
              { onSuccess: () => limparForm() },
            )
          }
        >
          {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Criar pacote
        </NeonButton>
      </GlassCard>

      {isPending ? (
        <Loading label="Carregando pacotes..." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(pacotes ?? []).map((p: Pacote) => (
            <GlassCard key={p.id} accent={p.accent as Accent} hover className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold text-white">{p.nome}</div>
                  <div className="mt-0.5 font-sans text-[11px] text-white/40">
                    {p.tagline || `${p.servicos.length} apps`}
                  </div>
                </div>
                <span
                  className="shrink-0 font-display text-sm font-extrabold"
                  style={{ color: accentHex[p.accent as Accent] }}
                >
                  {brl(p.preco)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.servicos.map((id) => (
                  <AppIcon key={id} id={id as ServiceId} size="xs" active />
                ))}
              </div>

              {p.perks?.length ? (
                <ul className="mt-3 space-y-1">
                  {p.perks.slice(0, 3).map((perk) => (
                    <li key={perk} className="truncate font-sans text-[11px] text-white/40">
                      · {perk}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
                <Pill accent="cyan">{p.servicos.length} apps</Pill>
                {p.precoAnual ? <Pill accent="purple">anual {brl(p.precoAnual)}</Pill> : null}
                {p.destaque ? <Pill accent="red">destaque</Pill> : null}
                <button
                  type="button"
                  className="ml-auto flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                  aria-label="Excluir pacote"
                  disabled={remover.isPending}
                  onClick={() => remover.mutate({ id: p.id })}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RevenueChart() {
  const max = Math.max(...revenueSeries.map((r) => r.value));
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-sm font-bold text-white">Receita recorrente (MRR)</div>
          <div className="mt-0.5 font-sans text-[11px] text-white/35">
            série histórica ilustrativa · em R$ mil
          </div>
        </div>
        <Pill accent="cyan" icon={<BarChart3 className="size-3" />}>
          +70% no período
        </Pill>
      </div>

      <div className="mt-7 flex h-52 items-end gap-2.5 sm:gap-4">
        {revenueSeries.map((r, i) => {
          const h = 20 + (r.value / max) * 140;
          const isLast = i === revenueSeries.length - 1;
          return (
            <div key={r.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span
                className={cn(
                  "font-display text-[10px] font-bold",
                  isLast ? "text-neon-red" : "text-white/35",
                )}
              >
                {r.value.toFixed(1)}
              </span>
              <div
                className="w-full shrink-0 rounded-t-lg transition-all duration-700"
                style={{
                  height: `${h}px`,
                  background: isLast
                    ? "linear-gradient(180deg, #ff1f3d 0%, rgba(255,31,61,0.15) 100%)"
                    : "linear-gradient(180deg, rgba(34,211,238,0.85) 0%, rgba(34,211,238,0.06) 100%)",
                  boxShadow: isLast
                    ? "0 0 24px -6px #ff1f3d"
                    : "0 0 18px -8px rgba(34,211,238,0.9)",
                }}
              />
              <span className="font-sans text-[10px] uppercase tracking-widest text-white/30">
                {r.month}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* fila operacional derivada do banco */
function QueueCard() {
  const { data: contas } = useContas();
  const { data: clientes } = useUsuarios();

  const itens = useMemo(() => {
    const out: { title: string; detail: string; accent: Accent }[] = [];

    for (const c of contas ?? []) {
      if (c.vagasOcupadas >= c.totalVagas)
        out.push({
          title: `Repor ${c.rotulo}`,
          detail: `${c.vagasOcupadas}/${c.totalVagas} vagas ocupadas · renovação ${c.renovacao || "—"}`,
          accent: "red",
        });
      else if (c.status === "manutencao")
        out.push({
          title: `Trocar senha · ${c.rotulo}`,
          detail: `Conta em manutenção · ${c.email}`,
          accent: "purple",
        });
    }

    for (const u of clientes ?? []) {
      if (u.statusPagamento === "inadimplente")
        out.push({
          title: `Cobrar ${u.nome}`,
          detail: `${brl(u.valor)} · vencimento ${u.proximaCobranca || "—"}`,
          accent: "red",
        });
      else if (u.statusPagamento === "vencendo")
        out.push({
          title: `Fatura vencendo · ${u.nome}`,
          detail: `${brl(u.valor)} · vence ${u.proximaCobranca || "—"}`,
          accent: "cyan",
        });
    }

    return out.slice(0, 8);
  }, [contas, clientes]);

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-neon-red" />
        <div className="font-display text-sm font-bold text-white">Fila operacional</div>
        <span className="ml-auto font-sans text-[11px] text-white/30">{itens.length} itens</span>
      </div>
      <div className="mt-5 space-y-3">
        {itens.map((q) => (
          <div
            key={q.title}
            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5"
            style={{ borderColor: `${accentHex[q.accent]}2e` }}
          >
            <span
              className="mt-0.5 size-2 shrink-0 rounded-full"
              style={{ background: accentHex[q.accent], boxShadow: `0 0 10px ${accentHex[q.accent]}` }}
            />
            <div className="min-w-0">
              <div className="font-display text-xs font-bold text-white">{q.title}</div>
              <div className="mt-0.5 font-sans text-[11px] leading-relaxed text-white/40">
                {q.detail}
              </div>
            </div>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="font-sans text-sm text-white/35">Nada pendente. Operação em dia.</p>
        )}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function ClientsTable({ compact = false }: { compact?: boolean }) {
  const { data, isPending, isError, error } = useUsuarios();
  const remover = useRemoverUsuario();

  const statusStyle = {
    ativo: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
    vencendo: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    inadimplente: "border-neon-red/45 bg-neon-red/12 text-neon-red",
  } as const;

  if (isPending) return <Loading label="Carregando clientes..." />;
  if (isError) return <ErrorBox message={error?.message} />;

  const rows = compact ? (data ?? []).slice(0, 5) : (data ?? []);

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-neon-cyan" />
          <div className="font-display text-sm font-bold text-white">
            {compact ? "Últimos clientes" : "Todos os clientes"}
          </div>
        </div>
        <span className="font-sans text-[11px] text-white/30">{rows.length} registros</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-white/8 text-left font-sans text-[10px] uppercase tracking-[0.16em] text-white/30">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-3 py-3 font-medium">Pacote</th>
              <th className="px-3 py-3 font-medium">Apps</th>
              <th className="px-3 py-3 font-medium">Valor</th>
              <th className="px-3 py-3 font-medium">Próx. cobrança</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {rows.map((c: Cliente) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.025]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-display text-[10px] font-bold text-white/60">
                      {c.nome
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-display text-xs font-semibold text-white">
                        {c.nome}
                      </div>
                      <div className="truncate font-mono text-[10px] text-white/30">{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 font-sans text-xs text-white/55">
                  {c.pacoteNome ?? "—"}
                  {c.ciclo === "anual" ? " (anual)" : ""}
                </td>
                <td className="px-3 py-3.5 font-display text-xs font-bold text-neon-cyan">
                  {c.pacoteServicos?.length ?? 0}
                </td>
                <td className="px-3 py-3.5 font-display text-xs font-bold text-white">
                  {brl(c.valor)}
                </td>
                <td className="px-3 py-3.5 font-sans text-xs text-white/45">
                  {c.proximaCobranca || "—"}
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest",
                      statusStyle[c.statusPagamento as keyof typeof statusStyle],
                    )}
                  >
                    {c.statusPagamento}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                    aria-label="Excluir cliente"
                    disabled={remover.isPending}
                    onClick={() => remover.mutate({ id: c.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function NovoClienteForm() {
  const { data: pacotes } = usePacotes();
  const criar = useCriarUsuario();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    pacoteId: 0,
    valor: 0,
    proximaCobranca: "",
  });

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <div className="font-display text-sm font-bold text-white">Novo cliente</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={input}
          placeholder="Nome"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />
        <input
          className={input}
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <select
          className={input}
          value={form.pacoteId}
          onChange={(e) => {
            const id = Number(e.target.value);
            const p = (pacotes ?? []).find((x) => x.id === id);
            setForm((f) => ({ ...f, pacoteId: id, valor: p?.preco ?? f.valor }));
          }}
        >
          <option value={0} className="bg-[#09090b]">
            Sem pacote
          </option>
          {(pacotes ?? []).map((p) => (
            <option key={p.id} value={p.id} className="bg-[#09090b]">
              {p.nome}
            </option>
          ))}
        </select>
        <input
          className={input}
          type="number"
          step="0.01"
          placeholder="Valor"
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
        />
        <input
          className={input}
          placeholder="Próx. cobrança (dd/mm/aaaa)"
          value={form.proximaCobranca}
          onChange={(e) => setForm((f) => ({ ...f, proximaCobranca: e.target.value }))}
        />
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">{criar.error?.message}</p>
      )}

      <NeonButton
        accent="cyan"
        size="sm"
        className="mt-4"
        disabled={criar.isPending || !form.nome || !form.email}
        onClick={() =>
          criar.mutate(
            {
              nome: form.nome,
              email: form.email,
              pacoteId: form.pacoteId || null,
              valor: form.valor,
              proximaCobranca: form.proximaCobranca,
              statusPagamento: "ativo",
              ciclo: "mensal",
              clienteDesde: new Date().toLocaleDateString("pt-BR"),
              admin: false,
            },
            {
              onSuccess: () =>
                setForm({ nome: "", email: "", pacoteId: 0, valor: 0, proximaCobranca: "" }),
            },
          )
        }
      >
        {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Cadastrar no banco
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function InvoicesAdminView() {
  const { data, isPending, isError, error } = useUsuarios();
  const resumo = useResumoClientes();

  if (isPending) return <Loading label="Carregando faturas..." />;
  if (isError) return <ErrorBox message={error?.message} />;

  const clientes = data ?? [];
  const pending = clientes.filter((c) => c.statusPagamento !== "ativo");
  const mrr = resumo.data?.mrr ?? 0;
  const ticket = clientes.length ? mrr / clientes.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Faturas a vencer",
            value: String(resumo.data?.vencendo ?? 0),
            sub: "próximos vencimentos",
            accent: "purple" as const,
          },
          { label: "MRR previsto", value: brl(mrr), sub: "receita recorrente", accent: "cyan" as const },
          {
            label: "Inadimplentes",
            value: String(resumo.data?.inadimplentes ?? 0),
            sub: `${brl(resumo.data?.emAtraso ?? 0)} em atraso`,
            accent: "red" as const,
          },
          { label: "Ticket médio", value: brl(ticket), sub: `${clientes.length} clientes`, accent: "cyan" as const },
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

      <GlassCard accent="red" className="p-5">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="size-4 text-neon-red" />
          <div className="font-display text-sm font-bold text-white">Cobranças pendentes</div>
        </div>
        <div className="mt-4 space-y-2.5">
          {pending.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neon-red/30 bg-neon-red/10">
                <Receipt className="size-4 text-neon-red" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-xs font-bold text-white">{c.nome}</div>
                <div className="font-sans text-[11px] text-white/35">
                  {c.pacoteNome ?? "sem pacote"} · vencimento {c.proximaCobranca || "—"}
                </div>
              </div>
              <span className="font-display text-sm font-bold text-white">{brl(c.valor)}</span>
              <a
                href={whatsappLink(
                  `Olá ${c.nome}! Passando para lembrar da sua fatura de ${brl(c.valor)} na PLAPLUSNOW.`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <NeonButton accent="red" variant="outline" size="sm">
                  Cobrar no WhatsApp
                </NeonButton>
              </a>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="font-sans text-sm text-white/35">Nenhuma cobrança pendente.</p>
          )}
        </div>
      </GlassCard>

      <ClientsTable />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [active, setActive] = useState("visao");
  const contas = useContas();
  const clientes = useUsuarios();
  const pacotes = usePacotes();

  const esgotadas = (contas.data ?? []).filter((c) => c.vagasOcupadas >= c.totalVagas).length;
  const aVencer = (clientes.data ?? []).filter((c) => c.statusPagamento !== "ativo").length;

  const nav: NavItem[] = [
    { id: "visao", label: "Visão Geral", icon: LayoutDashboard },
    {
      id: "estoque",
      label: "Gestão de Estoque",
      icon: Boxes,
      badge: esgotadas ? String(esgotadas) : undefined,
    },
    {
      id: "pacotes",
      label: "Pacotes",
      icon: Layers,
      badge: pacotes.data ? String(pacotes.data.length) : undefined,
    },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "faturas", label: "Faturas", icon: Receipt, badge: aVencer ? String(aVencer) : undefined },
  ];

  const titles: Record<string, { title: string; sub: string }> = {
    visao: { title: "Visão Geral", sub: "Saúde da operação, direto do banco de dados." },
    estoque: {
      title: "Gestão de Estoque / Contas Matrizes",
      sub: "Lotação real de cada conta compartilhada. Alocar e repor grava no banco.",
    },
    pacotes: { title: "Pacotes", sub: "Combos vendidos: nome, preço e serviços incluídos." },
    clientes: { title: "Clientes", sub: "Base completa de assinantes e seus pacotes." },
    faturas: { title: "Faturas", sub: "Cobranças a vencer, recebimentos e inadimplência." },
  };

  return (
    <div className="relative min-h-screen">
      <NeonBackdrop />
      <PanelShell
        nav={nav}
        active={active}
        onNavigate={setActive}
        accent="purple"
        role="Administrador"
        user={{ name: "Central PPN", email: "admin@plaplusnow.com", initials: "PN" }}
      >
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {titles[active].title}
              </h1>
              <p className="mt-1.5 font-sans text-sm text-white/40">{titles[active].sub}</p>
            </div>
            <Pill accent="purple" icon={<ShieldCheck className="size-3" />}>
              Sessão admin · dados do banco
            </Pill>
          </div>

          <SeedBanner />

          {active === "visao" && (
            <>
              <StatCards />
              <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <RevenueChart />
                <QueueCard />
              </div>
              <ClientsTable compact />
            </>
          )}

          {active === "estoque" && <StockView />}
          {active === "pacotes" && <PackagesView />}
          {active === "clientes" && (
            <>
              <StatCards />
              <NovoClienteForm />
              <ClientsTable />
            </>
          )}
          {active === "faturas" && <InvoicesAdminView />}
        </div>
      </PanelShell>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Goal,
  HeartPulse,
  HeartHandshake,
  Megaphone,
  Wallet,
  CircleDollarSign,
  Copy,
  Database,
  Layers,
  LayoutDashboard,
  MessageCircle,
  Smartphone,
  Loader2,
  Plus,
  LifeBuoy,
  Receipt,
  Search,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Power,
  Trash2,
  TrendingUp,
  Trophy,
  KeyRound,
  BookOpen,
  Ticket,
  Tv,
  UserPlus,
  Users,
  BellRing,
  CalendarClock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../components/app-icon";
import {
  ContaMatrizCard,
  diasParaVencer,
} from "../components/admin/conta-card";
import { AppsView } from "../components/admin/apps-view";
import { AfiliadosView } from "../components/admin/afiliados-view";
import { CodigosView } from "../components/admin/codigos-view";
import { SuporteView } from "../components/admin/suporte-view";
import { ManualView } from "../components/admin/manual-view";
import { NetflixTvView } from "../components/admin/netflix-tv-view";
import { CopilotoAdmin } from "../components/admin/copiloto";
import { MarketingView } from "../components/admin/marketing-view";
import { AlertasView } from "../components/admin/alertas-view";
import { GestaoContasView } from "../components/admin/gestao-contas-view";
import { EstoqueGiftView } from "../components/admin/estoque-gift-view";
import { JogosView } from "../components/admin/jogos-view";
import { SaudeView } from "../components/admin/saude-view";
import { RecuperacaoView } from "../components/admin/recuperacao-view";
import { SenhasView } from "../components/admin/senhas-view";
import { ComissoesView } from "../components/admin/comissoes-view";
import { PixView } from "../components/admin/pix-view";
import { BarraSalvamento, useAutoSalvar } from "../components/admin/salvamento";
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
  Ajuda,
  Campo,
  Rotulo,
  TituloSecao,
  Tooltip,
} from "../components/ui/tooltip";
import {
  brl,
  serviceById,
  services,
  whatsappLink,
  type Accent,
  type ServiceId,
} from "@/lib/mock-data";
import { useContas, useCriarConta, useResumoEstoque } from "../queries/contas";
import { useAlocarPorServico, useMapaAlocacoes } from "../queries/alocacoes";
import { useAplicativos } from "../queries/aplicativos";
import { useResumoSuporte } from "../queries/suporte";
import { useResumoRecompensas } from "../queries/recompensas";
import { useCodigos } from "../queries/codigos";
import { useResumoEstoqueGift } from "../queries/estoque-gift";
import { useFilaTvNetflix } from "../queries/netflix";
import {
  useFaturas,
  useResumoFaturas,
  useRegistrarPagamento,
  useSerieReceita,
  dataBr,
} from "../queries/faturas";
import {
  usePacotes,
  useCriarPacote,
  useAtualizarPacote,
  useRemoverPacote,
} from "../queries/pacotes";
import {
  useAlterarVencimento,
  useAtualizarUsuario,
  useConcederConfianca,
  useRevogarConfianca,
  useCriarUsuario,
  useEu,
  useHistoricoVencimento,
  useRemoverUsuario,
  useResumoClientes,
  useUsuarios,
  FORMAS_PAGAMENTO,
  ROTULO_STATUS_CLIENTE,
} from "../queries/usuarios";
import { useAlertasAdmin } from "../queries/notificacoes";
import { useRodarSeed, useSeedStatus } from "../queries/seed";

type Conta = NonNullable<ReturnType<typeof useContas>["data"]>[number];
type Cliente = NonNullable<ReturnType<typeof useUsuarios>["data"]>[number];
type Pacote = NonNullable<ReturnType<typeof usePacotes>["data"]>[number];

/* ------------------------------------------------------------------ */

function Loading({
  label = "Carregando dados do banco...",
}: {
  label?: string;
}) {
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
      <p className="mt-3 font-display text-sm font-bold text-white">
        Erro ao consultar o banco
      </p>
      <p className="mt-1.5 font-sans text-xs text-white/45">
        {message ?? "Tente novamente."}
      </p>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function SeedBanner() {
  const { data: status } = useSeedStatus();
  const seed = useRodarSeed();
  const vazio =
    status &&
    status.pacotes === 0 &&
    status.contas === 0 &&
    status.usuarios === 0;
  if (!vazio) return null;

  return (
    <GlassCard
      strong
      accent="cyan"
      className="flex flex-wrap items-center gap-4 p-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan">
        <Database className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-bold text-white">
          Banco vazio
        </div>
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
        {seed.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Database className="size-4" />
        )}
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
      delta: clientes.data
        ? `${clientes.data.total} cadastrados no total`
        : "carregando",
      accent: "cyan" as Accent,
      Icon: Users,
    },
    {
      label: "Faturas a vencer",
      value: clientes.data ? String(clientes.data.vencendo) : "—",
      delta: clientes.data
        ? `${brl(clientes.data.emAtraso)} em atraso`
        : "carregando",
      accent: "purple" as Accent,
      Icon: Receipt,
    },
    {
      label: "Receita mensal (MRR)",
      value: clientes.data ? brl(clientes.data.mrr) : "—",
      delta: estoque.data
        ? `custo de matrizes ${brl(estoque.data.custoMensal)}`
        : "carregando",
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
              style={{
                background: `radial-gradient(circle, ${hex}33 0%, transparent 70%)`,
              }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
                  {s.label}
                </div>
                <div className="mt-2 font-display text-3xl font-extrabold text-white">
                  {s.value}
                </div>
                <div
                  className="mt-1.5 font-sans text-[11px]"
                  style={{ color: hex }}
                >
                  {s.delta}
                </div>
              </div>
              <span
                className="flex size-10 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: `${hex}44`,
                  background: `${hex}14`,
                  color: hex,
                }}
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

function NovaContaForm({ onClose }: { onClose: () => void }) {
  const criar = useCriarConta();
  const catalogo = useAplicativos();
  const apps = (catalogo.data ?? []).filter((a) => a.ativo);
  const [form, setForm] = useState({
    servico: "netflix",
    rotulo: "",
    email: "",
    senha: "",
    totalVagas: 5,
    renovacao: "",
    custo: 0,
    regiao: "BR",
    dataVencimento: "",
    cartaoUtilizado: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

  return (
    <GlassCard strong accent="purple" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <TituloSecao ajuda="secao.estoque">Nova conta matriz</TituloSecao>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-xs text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Serviço" ajuda="contas.servico" htmlFor="nc-servico">
          <select
            id="nc-servico"
            value={form.servico}
            onChange={(e) => set("servico", e.target.value)}
            className={input}
          >
            {(apps.length
              ? apps
              : services.map((s) => ({ slug: s.id, nome: s.name }))
            ).map((a) => (
              <option key={a.slug} value={a.slug} className="bg-[#09090b]">
                {a.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          label="Rótulo"
          ajuda="contas.rotulo"
          htmlFor="nc-rotulo"
          obrigatorio
        >
          <input
            id="nc-rotulo"
            className={input}
            placeholder="Ex.: Netflix — Matriz 09"
            value={form.rotulo}
            onChange={(e) => set("rotulo", e.target.value)}
          />
        </Campo>
        <Campo
          label="E-mail do streaming"
          ajuda="contas.email"
          htmlFor="nc-email"
          obrigatorio
        >
          <input
            id="nc-email"
            className={input}
            placeholder="matriz@playplusnow.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Campo>
        <Campo
          label="Senha"
          ajuda="contas.senha"
          htmlFor="nc-senha"
          obrigatorio
        >
          <input
            id="nc-senha"
            className={input}
            placeholder="Senha da conta"
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
          />
        </Campo>
        <Campo
          label="Total de vagas"
          ajuda="contas.totalVagas"
          htmlFor="nc-vagas"
        >
          <input
            id="nc-vagas"
            className={input}
            type="number"
            min={1}
            value={form.totalVagas}
            onChange={(e) => set("totalVagas", Number(e.target.value))}
          />
        </Campo>
        <Campo
          label="Renovação"
          ajuda="contas.vencimento"
          htmlFor="nc-renovacao"
        >
          <input
            id="nc-renovacao"
            className={input}
            placeholder="dd/mm/aaaa"
            value={form.renovacao}
            onChange={(e) => set("renovacao", e.target.value)}
          />
        </Campo>
        <Campo
          label="Custo mensal"
          ajuda="contas.custoMensal"
          htmlFor="nc-custo"
        >
          <input
            id="nc-custo"
            className={input}
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.custo}
            onChange={(e) => set("custo", Number(e.target.value))}
          />
        </Campo>
        <Campo label="Região" ajuda="contas.regiao" htmlFor="nc-regiao">
          <input
            id="nc-regiao"
            className={input}
            placeholder="BR"
            value={form.regiao}
            onChange={(e) => set("regiao", e.target.value)}
          />
        </Campo>
        <Campo
          label="Data de vencimento"
          ajuda="contas.vencimento"
          htmlFor="nc-vencimento"
        >
          <input
            id="nc-vencimento"
            className={input}
            type="date"
            value={form.dataVencimento}
            onChange={(e) => set("dataVencimento", e.target.value)}
          />
        </Campo>
        <Campo
          label="Cartão utilizado"
          ajuda="contas.cartao"
          htmlFor="nc-cartao"
        >
          <input
            id="nc-cartao"
            className={input}
            placeholder="Ex.: Nubank final 4412"
            value={form.cartaoUtilizado}
            onChange={(e) => set("cartaoUtilizado", e.target.value)}
          />
        </Campo>
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">
          {criar.error?.message}
        </p>
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
              rotulo:
                form.rotulo || `${serviceById(form.servico).name} — Matriz`,
              vagasOcupadas: 0,
              status: "ativo",
            },
            { onSuccess: onClose },
          )
        }
      >
        {criar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        Salvar no banco
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function StockView() {
  const { data: contas, isPending, isError, error } = useContas();
  const resumo = useResumoEstoque();
  const mapa = useMapaAlocacoes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "todas" | "esgotadas" | "livres" | "vencendo"
  >("todas");
  const [criando, setCriando] = useState(false);

  const filtered = useMemo(() => {
    return (contas ?? []).filter((a) => {
      const q = query.toLowerCase();
      const matchesQuery =
        a.rotulo.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      const full = a.vagasOcupadas >= a.totalVagas;
      const dias = diasParaVencer(a.dataVencimento);
      const matchesFilter =
        filter === "todas"
          ? true
          : filter === "esgotadas"
            ? full
            : filter === "vencendo"
              ? dias !== null && dias <= 5
              : !full;
      return matchesQuery && matchesFilter;
    });
  }, [contas, query, filter]);

  if (isError) return <ErrorBox message={error?.message} />;

  const totalSlots = resumo.data?.vagasTotais ?? 0;
  const usedSlots = resumo.data?.vagasOcupadas ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            sub: totalSlots
              ? `${Math.round((usedSlots / totalSlots) * 100)}% de ocupação`
              : "—",
            accent: "purple" as const,
          },
          {
            label: "Contas esgotadas",
            value: String(resumo.data?.esgotadas ?? 0),
            sub: "reposição recomendada",
            accent: "red" as const,
          },
          {
            label: "Vencendo em 5 dias",
            value: String(
              (resumo.data?.vencendo ?? 0) + (resumo.data?.vencidas ?? 0),
            ),
            sub: `${resumo.data?.vencidas ?? 0} já vencida(s)`,
            accent: "red" as const,
          },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">
              {s.value}
            </div>
            <div
              className="mt-1 font-sans text-[11px]"
              style={{ color: accentHex[s.accent] }}
            >
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
            aria-label="Buscar conta matriz ou login"
            placeholder="Buscar conta matriz ou login..."
            className="w-full bg-transparent font-sans text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
          <Ajuda ajuda="busca.contas" />
        </div>
        <div className="flex gap-1.5">
          {(["todas", "esgotadas", "livres", "vencendo"] as const).map((f) => (
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
        <NeonButton
          accent="purple"
          size="md"
          onClick={() => setCriando((v) => !v)}
        >
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
              <ContaMatrizCard
                key={acc.id}
                acc={acc}
                vinculos={mapa.data?.[acc.id] ?? []}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <GlassCard className="p-10 text-center">
              <Boxes className="mx-auto size-6 text-white/20" />
              <p className="mt-3 font-sans text-sm text-white/40">
                Nenhuma conta encontrada.
              </p>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * EDICAO COMPLETA DO PACOTE
 * ------------------------------------------------------------------
 * Mesmos campos do formulario de criacao, ja preenchidos. Salva via
 * `pacotes.atualizar`, que aceita o input parcial — mandamos o objeto
 * inteiro para o admin conseguir corrigir qualquer campo numa passada.
 */
function ModalEditarPacote({
  pacote,
  onClose,
}: {
  pacote: Pacote;
  onClose: () => void;
}) {
  const atualizar = useAtualizarPacote();
  const [form, setFormRaw] = useState({
    nome: pacote.nome,
    tagline: pacote.tagline ?? "",
    preco: pacote.preco,
    precoAnual: pacote.precoAnual ?? 0,
    vagasRestantes: pacote.vagasRestantes ?? 0,
    perks: (pacote.perks ?? []).join(", "),
    badge: pacote.badge ?? "",
    accent: (pacote.accent ?? "cyan") as Accent,
    destaque: pacote.destaque,
    servicos: [...(pacote.servicos ?? [])] as string[],
  });

  /**
   * Todo setForm limpa o erro anterior: se o admin mexeu no campo depois da
   * falha, é uma tentativa nova e o auto-save volta a valer.
   */
  const setForm: typeof setFormRaw = (valor) => {
    atualizar.reset();
    setFormRaw(valor);
  };

  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      servicos: f.servicos.includes(id)
        ? f.servicos.filter((x) => x !== id)
        : [...f.servicos, id],
    }));

  const perksLista = form.perks
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  /** payload único: o auto-save e o Confirmar gravam exatamente a mesma coisa */
  const payload = {
    id: pacote.id,
    nome: form.nome.trim(),
    tagline: form.tagline,
    preco: form.preco,
    precoAnual: form.precoAnual > 0 ? form.precoAnual : null,
    servicos: form.servicos,
    perks: perksLista,
    accent: form.accent,
    badge: form.badge.trim() || null,
    destaque: form.destaque,
    vagasRestantes: form.vagasRestantes,
  };

  const valido = form.nome.trim().length > 0 && form.servicos.length > 0;

  /** comparado com o que veio do banco: define o selo e dispara o auto-save */
  const mudou =
    valido &&
    (payload.nome !== pacote.nome ||
      payload.tagline !== (pacote.tagline ?? "") ||
      payload.preco !== pacote.preco ||
      payload.precoAnual !== (pacote.precoAnual ?? null) ||
      payload.badge !== (pacote.badge ?? null) ||
      payload.accent !== (pacote.accent ?? "cyan") ||
      payload.destaque !== pacote.destaque ||
      payload.vagasRestantes !== (pacote.vagasRestantes ?? 0) ||
      perksLista.join("|") !== (pacote.perks ?? []).join("|") ||
      [...payload.servicos].sort().join("|") !==
        [...(pacote.servicos ?? [])].sort().join("|"));

  const { estado, confirmar } = useAutoSalvar({
    mudou,
    salvando: atualizar.isPending,
    erro: atualizar.isError
      ? (atualizar.error?.message ?? "Falha ao salvar")
      : null,
    salvar: () => atualizar.mutate(payload),
  });

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/12 bg-[#0b0b0f] p-6"
        data-testid="modal-editar-pacote"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Editar pacote
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-white">
              {pacote.nome}
            </h3>
            <p className="mt-1 font-sans text-[12px] text-white/40">
              As mudanças valem na hora na landing. Quem já assina mantém os
              apps liberados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo
            label="Nome do pacote"
            ajuda="pacote.nome"
            htmlFor="ep-nome"
            obrigatorio
          >
            <input
              id="ep-nome"
              className={input}
              data-testid="editar-nome-pacote"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </Campo>
          <Campo
            label="Preço mensal"
            ajuda="pacote.precoMensal"
            htmlFor="ep-preco"
            obrigatorio
          >
            <input
              id="ep-preco"
              type="number"
              step="0.01"
              className={input}
              value={form.preco}
              onChange={(e) =>
                setForm((f) => ({ ...f, preco: Number(e.target.value) }))
              }
            />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo label="Tagline" ajuda="pacote.tagline" htmlFor="ep-tagline">
            <input
              id="ep-tagline"
              className={input}
              value={form.tagline}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagline: e.target.value }))
              }
            />
          </Campo>
          <Campo
            label="Preço anual /mês"
            ajuda="pacote.precoAnual"
            htmlFor="ep-preco-anual"
          >
            <input
              id="ep-preco-anual"
              type="number"
              step="0.01"
              className={input}
              value={form.precoAnual}
              onChange={(e) =>
                setForm((f) => ({ ...f, precoAnual: Number(e.target.value) }))
              }
            />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo
            label="Benefícios"
            ajuda="pacote.beneficios"
            htmlFor="ep-perks"
          >
            <input
              id="ep-perks"
              className={input}
              placeholder="Separados por vírgula"
              value={form.perks}
              onChange={(e) =>
                setForm((f) => ({ ...f, perks: e.target.value }))
              }
            />
          </Campo>
          <Campo
            label="Vagas restantes"
            ajuda="pacote.vagas"
            htmlFor="ep-vagas"
          >
            <input
              id="ep-vagas"
              type="number"
              className={input}
              value={form.vagasRestantes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  vagasRestantes: Number(e.target.value),
                }))
              }
            />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo
            label="Etiqueta do card"
            ajuda="pacote.badge"
            htmlFor="ep-badge"
          >
            <input
              id="ep-badge"
              className={input}
              placeholder="Ex.: Mais vendido"
              value={form.badge}
              onChange={(e) =>
                setForm((f) => ({ ...f, badge: e.target.value }))
              }
            />
          </Campo>
          <Campo
            label="Cor de destaque"
            ajuda="pacote.accent"
            htmlFor="ep-accent"
          >
            <select
              id="ep-accent"
              className={input}
              value={form.accent}
              onChange={(e) =>
                setForm((f) => ({ ...f, accent: e.target.value as Accent }))
              }
            >
              <option value="red" className="bg-[#09090b]">
                Vermelho
              </option>
              <option value="cyan" className="bg-[#09090b]">
                Ciano
              </option>
              <option value="purple" className="bg-[#09090b]">
                Roxo
              </option>
            </select>
          </Campo>
        </div>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 font-sans text-xs text-white/50">
          <input
            type="checkbox"
            checked={form.destaque}
            onChange={(e) =>
              setForm((f) => ({ ...f, destaque: e.target.checked }))
            }
            className="size-4 accent-[#ff1f3d]"
          />
          Pacote em destaque
          <Ajuda ajuda="pacote.destaque" />
        </label>

        <div className="mt-4">
          <Rotulo ajuda="pacote.apps">
            Apps do pacote ({form.servicos.length})
          </Rotulo>
          <div className="mt-2 flex flex-wrap gap-2">
            {services.map((sv) => {
              const on = form.servicos.includes(sv.id);
              return (
                <button
                  key={sv.id}
                  type="button"
                  onClick={() => toggle(sv.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-2 font-sans text-xs transition-all",
                    on
                      ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                      : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white",
                  )}
                >
                  <AppIcon id={sv.id} size="xs" active={on} />
                  {sv.name}
                </button>
              );
            })}
          </div>
        </div>

        {!valido && (
          <p className="mt-3 font-sans text-xs text-amber-300">
            Para salvar, o pacote precisa de nome e de pelo menos um app.
          </p>
        )}

        <BarraSalvamento
          className="mt-5"
          estado={estado}
          erro={atualizar.error?.message}
          rotulo="Confirmar alterações"
          onConfirmar={confirmar}
        />

        <button
          type="button"
          data-testid="salvar-pacote"
          onClick={onClose}
          className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2.5 font-sans text-xs text-white/50 transition-colors hover:border-white/25 hover:text-white"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

function PackagesView() {
  const { data: pacotes, isPending, isError, error } = usePacotes();
  const criar = useCriarPacote();
  const remover = useRemoverPacote();
  const atualizar = useAtualizarPacote();
  const [editando, setEditando] = useState<Pacote | null>(null);
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
        <TituloSecao ajuda="secao.pacotes">Novo pacote</TituloSecao>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo
            label="Nome do pacote"
            ajuda="pacote.nome"
            htmlFor="pk-nome"
            obrigatorio
          >
            <input
              id="pk-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Turbo 10 em 1"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
          <Campo
            label="Preço mensal"
            ajuda="pacote.precoMensal"
            htmlFor="pk-preco"
            obrigatorio
          >
            <input
              id="pk-preco"
              type="number"
              step="0.01"
              value={form.preco}
              onChange={(e) =>
                setForm((f) => ({ ...f, preco: Number(e.target.value) }))
              }
              placeholder="0,00"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo label="Tagline" ajuda="pacote.tagline" htmlFor="pk-tagline">
            <input
              id="pk-tagline"
              value={form.tagline}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagline: e.target.value }))
              }
              placeholder="Aparece no card da landing"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
          <Campo
            label="Preço anual /mês"
            ajuda="pacote.precoAnual"
            htmlFor="pk-preco-anual"
          >
            <input
              id="pk-preco-anual"
              type="number"
              step="0.01"
              value={form.precoAnual}
              onChange={(e) =>
                setForm((f) => ({ ...f, precoAnual: Number(e.target.value) }))
              }
              placeholder="0,00"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
          <Campo
            label="Benefícios"
            ajuda="pacote.beneficios"
            htmlFor="pk-perks"
          >
            <input
              id="pk-perks"
              value={form.perks}
              onChange={(e) =>
                setForm((f) => ({ ...f, perks: e.target.value }))
              }
              placeholder="Separados por vírgula"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
          <Campo
            label="Vagas restantes"
            ajuda="pacote.vagas"
            htmlFor="pk-vagas"
          >
            <input
              id="pk-vagas"
              type="number"
              value={form.vagasRestantes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  vagasRestantes: Number(e.target.value),
                }))
              }
              placeholder="0"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </Campo>
        </div>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 font-sans text-xs text-white/50">
          <input
            type="checkbox"
            checked={form.destaque}
            onChange={(e) =>
              setForm((f) => ({ ...f, destaque: e.target.checked }))
            }
            className="size-4 accent-[#ff1f3d]"
          />
          Pacote em destaque (usado no hero e no comparativo da landing)
          <Ajuda ajuda="pacote.destaque" />
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
          <p className="mt-3 font-sans text-xs text-neon-red">
            {criar.error?.message}
          </p>
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
          {criar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Criar pacote
        </NeonButton>
      </GlassCard>

      {isPending ? (
        <Loading label="Carregando pacotes..." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(pacotes ?? []).map((p: Pacote) => (
            <GlassCard
              key={p.id}
              accent={p.accent as Accent}
              hover
              className={cn(
                "flex flex-col p-5",
                !p.ativo && "opacity-55 saturate-50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold text-white">
                    {p.nome}
                  </div>
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
                    <li
                      key={perk}
                      className="truncate font-sans text-[11px] text-white/40"
                    >
                      · {perk}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
                <Pill accent="cyan">{p.servicos.length} apps</Pill>
                {p.precoAnual ? (
                  <Pill accent="purple">anual {brl(p.precoAnual)}</Pill>
                ) : null}
                {p.destaque ? <Pill accent="red">destaque</Pill> : null}
                {p.ativo ? null : (
                  <Pill
                    accent="red"
                    className="!text-white/60"
                    icon={<Power className="size-3" />}
                  >
                    inativo
                  </Pill>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Tooltip
                    texto="pacote.ativar"
                    titulo={p.ativo ? "Desativar" : "Ativar"}
                  >
                    <button
                      type="button"
                      data-testid={`ativar-pacote-${p.id}`}
                      aria-label={
                        p.ativo ? "Desativar pacote" : "Ativar pacote"
                      }
                      disabled={atualizar.isPending}
                      onClick={() =>
                        atualizar.mutate({ id: p.id, ativo: !p.ativo })
                      }
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-sans text-[11px] transition-colors",
                        p.ativo
                          ? "border-neon-cyan/45 text-neon-cyan hover:bg-neon-cyan/10"
                          : "border-white/12 text-white/40 hover:border-white/30 hover:text-white",
                      )}
                    >
                      <Power className="size-3.5" />
                      {p.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </Tooltip>

                  <Tooltip texto="pacote.editar" titulo="Editar pacote">
                    <button
                      type="button"
                      data-testid={`editar-pacote-${p.id}`}
                      aria-label="Editar pacote"
                      onClick={() => setEditando(p)}
                      className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </Tooltip>

                  <Tooltip texto="pacote.excluir" titulo="Excluir pacote">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                      aria-label="Excluir pacote"
                      disabled={remover.isPending}
                      onClick={() => remover.mutate({ id: p.id })}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {editando && (
        <ModalEditarPacote
          pacote={editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RevenueChart() {
  // serie real: soma do que foi faturado por competencia (ja com desconto)
  const { data, isPending } = useSerieReceita(7);
  const serie = data?.serie ?? [];
  const max = Math.max(1, ...serie.map((r) => r.valor));
  const variacao = data?.variacao ?? 0;

  return (
    <GlassCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-sm font-bold text-white">
            Receita faturada
          </div>
          <div className="mt-0.5 font-sans text-[11px] text-white/35">
            últimos 7 meses · receita reconhecida (planos anuais rateados)
          </div>
        </div>
        <Pill
          accent={variacao >= 0 ? "cyan" : "red"}
          icon={<BarChart3 className="size-3" />}
        >
          {variacao >= 0 ? "+" : ""}
          {variacao}% no período
        </Pill>
      </div>

      <div className="mt-7 flex min-h-52 flex-1 items-end gap-2.5 sm:gap-4">
        {isPending && (
          <p className="w-full self-center text-center font-sans text-sm text-white/30">
            Calculando receita...
          </p>
        )}
        {serie.map((r, i) => {
          const h = 18 + (r.valor / max) * 74;
          const isLast = i === serie.length - 1;
          return (
            <div
              key={r.competencia}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
              title={`${r.faturas} fatura(s) · ${brl(r.valor)}`}
            >
              <span
                className={cn(
                  "font-display text-[10px] font-bold",
                  isLast ? "text-neon-red" : "text-white/35",
                )}
              >
                {(r.valor / 1000).toFixed(1)}k
              </span>
              <div
                className="w-full shrink-0 rounded-t-lg transition-all duration-700"
                style={{
                  height: `${h}%`,
                  background: isLast
                    ? "linear-gradient(180deg, #ff1f3d 0%, rgba(255,31,61,0.15) 100%)"
                    : "linear-gradient(180deg, rgba(34,211,238,0.85) 0%, rgba(34,211,238,0.06) 100%)",
                  boxShadow: isLast
                    ? "0 0 24px -6px #ff1f3d"
                    : "0 0 18px -8px rgba(34,211,238,0.9)",
                }}
              />
              <span className="font-sans text-[10px] uppercase tracking-widest text-white/30">
                {r.rotulo}
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
      if (u.statusPagamento === "suspenso")
        out.push({
          title: `Suspenso · ${u.nome}`,
          detail: `${brl(u.valor)} · vencido em ${u.proximaCobranca || "—"} · acesso bloqueado`,
          accent: "red",
        });
      else if (u.statusPagamento === "atrasado")
        out.push({
          title: `Cobrar ${u.nome}`,
          detail: `${brl(u.valor)} · vencimento ${u.proximaCobranca || "—"}`,
          accent: "red",
        });
      else if (u.statusPagamento === "pendente")
        out.push({
          title: `Fatura pendente · ${u.nome}`,
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
        <div className="font-display text-sm font-bold text-white">
          Fila operacional
        </div>
        <span className="ml-auto font-sans text-[11px] text-white/30">
          {itens.length} itens
        </span>
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
              style={{
                background: accentHex[q.accent],
                boxShadow: `0 0 10px ${accentHex[q.accent]}`,
              }}
            />
            <div className="min-w-0">
              <div className="font-display text-xs font-bold text-white">
                {q.title}
              </div>
              <div className="mt-0.5 font-sans text-[11px] leading-relaxed text-white/40">
                {q.detail}
              </div>
            </div>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="font-sans text-sm text-white/35">
            Nada pendente. Operação em dia.
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

const ABAS_STATUS = [
  { id: "todos", rotulo: "Todos" },
  { id: "ativo", rotulo: "Finalizados" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "atrasado", rotulo: "Atrasados" },
  { id: "suspenso", rotulo: "Suspensos" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  ativo: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  pendente: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  atrasado: "border-neon-red/45 bg-neon-red/12 text-neon-red",
  suspenso: "border-white/25 bg-white/10 text-white/70",
};

/** Duração padrão do crédito de confiança, igual ao HORAS_CONFIANCA do servidor. */
const HORAS_PADRAO_CONFIANCA = 48;

/** Modal da trava de vencimento: exige motivo e mostra o historico. */
function ModalVencimento({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
  const alterar = useAlterarVencimento();
  const historico = useHistoricoVencimento(cliente.id);
  const [data, setData] = useState(cliente.proximaCobranca || "");
  const [motivo, setMotivo] = useState("");

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/12 bg-[#0b0b0f] p-6"
        data-testid="modal-vencimento"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Trava de vencimento
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-white">
              Alterar vencimento · {cliente.nome}
            </h3>
            <p className="mt-1 font-sans text-[12px] text-white/40">
              Data atual {cliente.proximaCobranca || "—"}. Toda mudança fica
              registrada com autor, data e motivo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <Campo
            label="Nova data"
            ajuda="fatura.novaData"
            htmlFor="mv-data"
            obrigatorio
          >
            <input
              id="mv-data"
              className={input}
              placeholder="dd/mm/aaaa"
              data-testid="nova-data-vencimento"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
          <Campo
            label="Motivo da alteração"
            ajuda="fatura.motivo"
            htmlFor="mv-motivo"
            obrigatorio
          >
            <textarea
              id="mv-motivo"
              className={cn(input, "min-h-[90px] resize-y")}
              placeholder="Mínimo 5 caracteres"
              data-testid="motivo-vencimento"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
          {alterar.isError && (
            <p className="font-sans text-xs text-neon-red">
              {alterar.error?.message}
            </p>
          )}
          <NeonButton
            accent="purple"
            size="sm"
            data-testid="salvar-vencimento"
            disabled={
              alterar.isPending || motivo.trim().length < 5 || !data.trim()
            }
            onClick={() =>
              alterar.mutate(
                {
                  id: cliente.id,
                  proximaCobranca: data.trim(),
                  motivo: motivo.trim(),
                },
                { onSuccess: onClose },
              )
            }
          >
            {alterar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            Salvar e registrar
          </NeonButton>
        </div>

        <div className="mt-6 border-t border-white/8 pt-4">
          <div className="font-display text-xs font-bold text-white/70">
            Histórico
          </div>
          <div className="mt-3 space-y-2">
            {(historico.data ?? []).length === 0 && (
              <p className="font-sans text-[12px] text-white/35">
                Nenhuma alteração registrada.
              </p>
            )}
            {(historico.data ?? []).map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-white/8 bg-white/[0.03] p-3 font-sans text-[11.5px] text-white/45"
              >
                <span className="text-white/70">
                  {h.de || "—"} → {h.para}
                </span>
                <span className="block mt-0.5">{h.motivo}</span>
                <span className="mt-0.5 block text-[10.5px] text-white/25">
                  {h.autor}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CREDITO DE CONFIANCA
 * ------------------------------------------------------------------
 * Quando o cliente atrasa, o admin pode liberar o acesso por um prazo curto
 * (padrao 48h). Nao e uma flag de "confiavel": e uma DATA LIMITE gravada no
 * cliente. Enquanto ela nao vence, o servidor trata o cliente como se
 * estivesse em dia (logins, senhas, codigos, suporte, jornada). Vencendo,
 * o bloqueio volta sozinho — sem rotina de limpeza para dar manutencao.
 *
 * Conceder de novo com credito ativo ESTENDE a partir de agora (nao soma) e
 * nao conta como uma nova vez no contador.
 */
function ModalConfianca({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
  const conceder = useConcederConfianca();
  const [horas, setHoras] = useState(HORAS_PADRAO_CONFIANCA);
  const [motivo, setMotivo] = useState("");
  const ativa = cliente.confianca?.ativa ?? false;

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/12 bg-[#0b0b0f] p-6"
        data-testid="modal-confianca"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-neon-cyan/70">
              Crédito de confiança
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-white">
              Liberar acesso · {cliente.nome}
            </h3>
            <p className="mt-1 font-sans text-[12px] text-white/40">
              O cliente volta a usar tudo normalmente durante o prazo, como se
              estivesse em dia. Quando o prazo vence, o bloqueio volta
              automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {ativa && (
          <div className="mt-4 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.07] p-3 font-sans text-[12px] text-neon-cyan">
            Já existe um crédito ativo, restam{" "}
            {cliente.confianca.horasRestantes}h{" "}
            {cliente.confianca.minutosRestantes}m. Salvar aqui recomeça a
            contagem a partir de agora.
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {[24, 48, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHoras(h)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 font-sans text-[11.5px] transition-colors",
                  horas === h
                    ? "border-neon-cyan/55 bg-neon-cyan/12 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/25",
                )}
              >
                {h === 168 ? "7 dias" : `${h}h`}
              </button>
            ))}
          </div>

          <Campo
            label="Duração (horas)"
            ajuda="cliente.confiancaHoras"
            htmlFor="cf-horas"
            obrigatorio
          >
            <input
              id="cf-horas"
              type="number"
              min={1}
              max={720}
              className={input}
              data-testid="horas-confianca"
              value={horas}
              onChange={(e) => setHoras(Number(e.target.value))}
            />
          </Campo>

          <Campo
            label="Motivo"
            ajuda="cliente.confiancaMotivo"
            htmlFor="cf-motivo"
          >
            <textarea
              id="cf-motivo"
              className={cn(input, "min-h-[80px] resize-y")}
              placeholder="Ex.: cliente avisou que paga na sexta"
              data-testid="motivo-confianca"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>

          {conceder.isError && (
            <p className="font-sans text-xs text-neon-red">
              {conceder.error?.message}
            </p>
          )}

          <NeonButton
            accent="cyan"
            size="sm"
            data-testid="salvar-confianca"
            disabled={conceder.isPending || horas < 1 || horas > 720}
            onClick={() =>
              conceder.mutate(
                { id: cliente.id, horas, motivo: motivo.trim() },
                { onSuccess: onClose },
              )
            }
          >
            {conceder.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {ativa ? "Renovar crédito" : `Liberar por ${horas}h`}
          </NeonButton>

          <p className="font-sans text-[11px] text-white/30">
            Créditos já concedidos a esse cliente:{" "}
            {cliente.confianca?.vezes ?? 0}.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClientsTable({ compact = false }: { compact?: boolean }) {
  const { data, isPending, isError, error } = useUsuarios();
  const remover = useRemoverUsuario();
  const atualizar = useAtualizarUsuario();
  const [aba, setAba] = useState<string>("todos");
  const [editandoVencimento, setEditandoVencimento] = useState<Cliente | null>(
    null,
  );
  const [dandoConfianca, setDandoConfianca] = useState<Cliente | null>(null);
  const [adicionandoApp, setAdicionandoApp] = useState<Cliente | null>(null);
  const revogar = useRevogarConfianca();

  if (isPending) return <Loading label="Carregando clientes..." />;
  if (isError) return <ErrorBox message={error?.message} />;

  const todos = (data ?? []) as Cliente[];
  const contagem = (id: string) =>
    id === "todos"
      ? todos.length
      : todos.filter((c) => c.statusPagamento === id).length;

  const filtrados =
    aba === "todos" ? todos : todos.filter((c) => c.statusPagamento === aba);
  const rows = compact ? filtrados.slice(0, 5) : filtrados;

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-neon-cyan" />
          <div className="font-display text-sm font-bold text-white">
            {compact ? "Últimos clientes" : "Todos os clientes"}
          </div>
        </div>
        <span className="font-sans text-[11px] text-white/30">
          {rows.length} registros
        </span>
      </div>

      {!compact && (
        <div
          className="flex flex-wrap gap-2 border-b border-white/8 px-5 py-3"
          data-testid="abas-status"
        >
          {ABAS_STATUS.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`aba-${a.id}`}
              onClick={() => setAba(a.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 font-sans text-[11.5px] transition-colors",
                aba === a.id
                  ? "border-neon-purple/55 bg-neon-purple/12 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/25",
              )}
            >
              {a.rotulo}
              <span className="ml-1.5 font-display text-[10.5px] text-white/35">
                {contagem(a.id)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/8 text-left font-sans text-[10px] uppercase tracking-[0.16em] text-white/30">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-3 py-3 text-center font-medium">Nível</th>
              <th className="px-3 py-3 font-medium">Contatos &amp; aparelhos</th>
              <th className="px-3 py-3 font-medium">Pacote</th>
              <th className="px-3 py-3 font-medium">Valor</th>
              <th className="px-3 py-3 font-medium">Forma de pagamento</th>
              <th className="px-3 py-3 font-medium">Próx. cobrança</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {rows.map((c: Cliente) => (
              <tr
                key={c.id}
                className="transition-colors hover:bg-white/[0.025]"
              >
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
                      <div className="flex items-center gap-2 truncate font-display text-xs font-semibold text-white">
                        {c.nome}
                        {c.admin && (
                          <Tooltip texto="cliente.adminSelo" titulo="Administrador">
                            <ShieldCheck className="size-3 shrink-0 text-neon-purple" />
                          </Tooltip>
                        )}
                      </div>
                      <div className="truncate font-mono text-[10px] text-white/30">
                        {c.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-center">
                  <select
                    aria-label={`Nível do cliente ${c.nome}`}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 font-sans text-[11px] text-white/70 focus:border-neon-cyan/50 focus:outline-none"
                    value={c.nivel ?? 1}
                    onChange={(e) => atualizar.mutate({ id: c.id, nivel: Number(e.target.value) })}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n} className="bg-[#09090b]">
                        Nível {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 font-sans text-[11px] text-white/60">
                      <Smartphone className="size-3 shrink-0 text-neon-cyan" />
                      <span className="max-w-[150px] truncate">{c.aparelhos || "—"}</span>
                    </span>
                    {c.telefone && (
                      <a
                        href={whatsappLink(c.telefone, `Olá, ${c.nome}!`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-sans text-[11px] text-white/40 hover:text-neon-cyan"
                      >
                        <MessageCircle className="size-3 shrink-0" />
                        {c.telefone}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3.5 font-sans text-xs text-white/55">
                  {c.pacoteNome ?? "—"}
                  {c.ciclo === "anual" ? " (anual)" : ""}
                </td>
                <td className="px-3 py-3.5 font-display text-xs font-bold text-white">
                  {brl(c.valor)}
                </td>
                <td className="px-3 py-3.5">
                  <select
                    aria-label="Forma de pagamento do cliente"
                    data-testid={`forma-pagamento-${c.id}`}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 font-sans text-[11px] text-white/70 focus:border-neon-purple/50 focus:outline-none"
                    value={c.formaPagamento ?? "pix"}
                    onChange={(e) =>
                      atualizar.mutate({
                        id: c.id,
                        formaPagamento: e.target.value as "pix",
                      })
                    }
                  >
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option
                        key={f.valor}
                        value={f.valor}
                        className="bg-[#09090b]"
                      >
                        {f.rotulo}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-white/45">
                      {c.proximaCobranca || "—"}
                    </span>
                    <Tooltip
                      texto="fatura.novaData"
                      titulo="Alterar vencimento"
                    >
                      <button
                        type="button"
                        data-testid={`alterar-vencimento-${c.id}`}
                        onClick={() => setEditandoVencimento(c)}
                        aria-label="Alterar vencimento"
                        className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
                      >
                        <CalendarClock className="size-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={cn(
                      "inline-block rounded-full border px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest",
                      STATUS_STYLE[c.statusPagamento] ?? STATUS_STYLE.pendente,
                    )}
                  >
                    {ROTULO_STATUS_CLIENTE[c.statusPagamento] ??
                      c.statusPagamento}
                  </span>
                  {c.confianca?.ativa && (
                    <div
                      className="mt-1.5"
                      data-testid={`selo-confianca-${c.id}`}
                    >
                      <Tooltip
                        texto="cliente.confiancaAtiva"
                        titulo="Crédito de confiança ativo"
                        lado="left"
                      >
                        <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-2 py-0.5 font-sans text-[10px] text-neon-cyan">
                          <ShieldCheck className="size-3" />
                          {c.confianca.horasRestantes}h{" "}
                          {c.confianca.minutosRestantes}m
                        </span>
                      </Tooltip>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip texto="cliente.alocarApp" titulo="Adicionar app manualmente" lado="left">
                      <button
                        type="button"
                        aria-label={`Adicionar app para ${c.nome}`}
                        onClick={() => setAdicionandoApp(c)}
                        className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip
                      texto="cliente.admin"
                      titulo={c.admin ? "Remover acesso admin" : "Tornar administrador"}
                      lado="left"
                    >
                      <button
                        type="button"
                        aria-label={c.admin ? `Remover admin de ${c.nome}` : `Tornar ${c.nome} admin`}
                        disabled={atualizar.isPending}
                        onClick={() => {
                          const msg = c.admin
                            ? `Remover os privilégios de administrador de ${c.nome}?`
                            : `Tornar ${c.nome} administrador do sistema?`;
                          if (confirm(msg)) atualizar.mutate({ id: c.id, admin: !c.admin });
                        }}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border transition-colors",
                          c.admin
                            ? "border-neon-purple/55 bg-neon-purple/12 text-white"
                            : "border-white/10 text-white/30 hover:border-neon-purple/50 hover:text-neon-purple",
                        )}
                      >
                        <KeyRound className="size-3.5" />
                      </button>
                    </Tooltip>
                    {c.confianca?.ativa ? (
                      <Tooltip
                        texto="cliente.confiancaRevogar"
                        titulo="Encerrar crédito"
                        lado="left"
                      >
                        <button
                          type="button"
                          data-testid={`revogar-confianca-${c.id}`}
                          aria-label="Encerrar crédito de confiança"
                          disabled={revogar.isPending}
                          onClick={() => revogar.mutate({ id: c.id })}
                          className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-amber-400/60 hover:text-amber-300"
                        >
                          <ShieldOff className="size-3.5" />
                        </button>
                      </Tooltip>
                    ) : (
                      <Tooltip
                        texto="cliente.confianca"
                        titulo="Crédito de confiança"
                        lado="left"
                      >
                        <button
                          type="button"
                          data-testid={`dar-confianca-${c.id}`}
                          aria-label="Conceder crédito de confiança"
                          onClick={() => setDandoConfianca(c)}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg border transition-colors",
                            c.statusPagamento === "atrasado" ||
                              c.statusPagamento === "suspenso"
                              ? "border-neon-cyan/45 text-neon-cyan hover:bg-neon-cyan/10"
                              : "border-white/10 text-white/30 hover:border-neon-cyan/50 hover:text-neon-cyan",
                          )}
                        >
                          <ShieldCheck className="size-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip texto="cliente.excluir" titulo="Excluir cliente">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                        aria-label="Excluir cliente"
                        disabled={remover.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Excluir o cliente ${c.nome}? A ação é irreversível.`,
                            )
                          ) {
                            remover.mutate({ id: c.id });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-10 text-center font-sans text-sm text-white/35"
                >
                  Nenhum cliente nesta aba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editandoVencimento && (
        <ModalVencimento
          cliente={editandoVencimento}
          onClose={() => setEditandoVencimento(null)}
        />
      )}

      {adicionandoApp && (
        <ModalAdicionarAppCliente
          cliente={adicionandoApp}
          onClose={() => setAdicionandoApp(null)}
        />
      )}
      {dandoConfianca && (
        <ModalConfianca
          cliente={dandoConfianca}
          onClose={() => setDandoConfianca(null)}
        />
      )}
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ALOCAÇÃO MANUAL — coloca o cliente em uma vaga livre de conta matriz do
 * serviço escolhido. Sem vaga, o servidor devolve erro em vez de alocar.
 */
function ModalAdicionarAppCliente({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
  const alocar = useAlocarPorServico();
  const { data: apps } = useAplicativos();
  const ativos = (apps ?? []).filter((a) => a.ativo);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b0f] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-sans text-[10px] uppercase tracking-[0.22em] text-white/35">
              Alocação manual
            </div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-white">
              Adicionar app · {cliente.nome}
            </h3>
            <p className="mt-1 font-sans text-xs text-white/40">
              Escolha o serviço — o sistema procura uma vaga livre nas contas matrizes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6 grid max-h-[50vh] gap-2 overflow-y-auto">
          {ativos.map((app) => (
            <button
              key={app.id}
              type="button"
              disabled={alocar.isPending}
              onClick={() =>
                alocar.mutate(
                  { clienteId: cliente.id, servico: app.slug },
                  { onSuccess: onClose },
                )
              }
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition-all hover:border-neon-cyan/50 hover:bg-white/[0.06] disabled:opacity-40"
            >
              <AppIcon id={app.slug as ServiceId} size="sm" active />
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold text-white">{app.nome}</div>
                <div className="font-sans text-[10px] text-white/30">
                  Alocar em uma matriz disponível
                </div>
              </div>
              {alocar.isPending && alocar.variables?.servico === app.slug ? (
                <Loader2 className="size-4 animate-spin text-neon-cyan" />
              ) : (
                <Plus className="size-4 text-white/20" />
              )}
            </button>
          ))}
          {ativos.length === 0 && (
            <p className="py-8 text-center font-sans text-sm text-white/30">
              Nenhum aplicativo ativo no catálogo.
            </p>
          )}
        </div>

        {alocar.isError && (
          <div className="mt-4 rounded-xl border border-neon-red/20 bg-neon-red/5 p-3 font-sans text-[11px] text-neon-red">
            {alocar.error.message}
          </div>
        )}
      </div>
    </div>
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
    admin: false,
  });

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-cyan/50 focus:outline-none";

  return (
    <GlassCard strong accent="cyan" className="p-5">
      <TituloSecao ajuda="secao.clientes">Novo cliente</TituloSecao>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo label="Nome" ajuda="cliente.nome" htmlFor="ncl-nome" obrigatorio>
          <input
            id="ncl-nome"
            className={input}
            placeholder="Nome do cliente"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </Campo>
        <Campo
          label="E-mail"
          ajuda="cliente.email"
          htmlFor="ncl-email"
          obrigatorio
        >
          <input
            id="ncl-email"
            className={input}
            placeholder="cliente@email.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Campo>
        <Campo label="Pacote" ajuda="cliente.pacote" htmlFor="ncl-pacote">
          <select
            id="ncl-pacote"
            className={input}
            value={form.pacoteId}
            onChange={(e) => {
              const id = Number(e.target.value);
              const p = (pacotes ?? []).find((x) => x.id === id);
              setForm((f) => ({
                ...f,
                pacoteId: id,
                valor: p?.preco ?? f.valor,
              }));
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
        </Campo>
        <Campo label="Valor cobrado" ajuda="cliente.valor" htmlFor="ncl-valor">
          <input
            id="ncl-valor"
            className={input}
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.valor}
            onChange={(e) =>
              setForm((f) => ({ ...f, valor: Number(e.target.value) }))
            }
          />
        </Campo>
        <Campo
          label="Próxima cobrança"
          ajuda="cliente.proximaCobranca"
          htmlFor="ncl-cobranca"
        >
          <input
            id="ncl-cobranca"
            className={input}
            placeholder="dd/mm/aaaa"
            value={form.proximaCobranca}
            onChange={(e) =>
              setForm((f) => ({ ...f, proximaCobranca: e.target.value }))
            }
          />
        </Campo>
      </div>

      {criar.isError && (
        <p className="mt-3 font-sans text-xs text-neon-red">
          {criar.error?.message}
        </p>
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
                setForm({
                  nome: "",
                  email: "",
                  pacoteId: 0,
                  valor: 0,
                  proximaCobranca: "",
                }),
            },
          )
        }
      >
        {criar.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserPlus className="size-4" />
        )}
        Cadastrar no banco
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function InvoicesAdminView() {
  // faturas reais vindas do banco (geradas a partir do historico de cada
  // cliente), ja com o cupom da Jornada aplicado quando houver.
  const { data, isPending, isError, error } = useFaturas();
  const resumo = useResumoFaturas();
  const clientes = useUsuarios();
  const baixa = useRegistrarPagamento();
  const [filtro, setFiltro] = useState<"pendentes" | "todas" | "pagas">(
    "pendentes",
  );

  if (isPending) return <Loading label="Carregando faturas..." />;
  if (isError) return <ErrorBox message={error?.message} />;

  const todas = data ?? [];
  const pendentes = todas.filter((f) => f.status !== "pago");
  const lista =
    filtro === "pendentes"
      ? pendentes
      : filtro === "pagas"
        ? todas.filter((f) => f.status === "pago")
        : todas;

  const totalClientes = (clientes.data ?? []).length;
  const ticket = totalClientes
    ? (resumo.data?.recebido ?? 0) / Math.max(1, totalClientes)
    : 0;

  const statusStyle: Record<string, string> = {
    pago: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
    aberto: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    vencido: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Faturas a vencer",
            value: String(resumo.data?.aVencer ?? 0),
            sub: `${brl(resumo.data?.totalEmAberto ?? 0)} em aberto`,
            accent: "purple" as const,
          },
          {
            label: "Recebido",
            value: brl(resumo.data?.recebido ?? 0),
            sub: "faturas quitadas",
            accent: "cyan" as const,
          },
          {
            label: "Vencidas",
            value: String(resumo.data?.vencidas ?? 0),
            sub: `${brl(resumo.data?.totalVencido ?? 0)} em atraso`,
            accent: "red" as const,
          },
          {
            label: "Desconto concedido",
            value: brl(resumo.data?.descontoConcedido ?? 0),
            sub: `ticket médio ${brl(ticket)}`,
            accent: "cyan" as const,
          },
        ].map((s) => (
          <GlassCard key={s.label} accent={s.accent} className="p-5">
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/35">
              {s.label}
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold text-white">
              {s.value}
            </div>
            <div
              className="mt-1 font-sans text-[11px]"
              style={{ color: accentHex[s.accent] }}
            >
              {s.sub}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard accent="red" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-4 text-neon-red" />
            <div className="font-display text-sm font-bold text-white">
              Faturas ({lista.length})
            </div>
          </div>
          <div className="flex gap-1.5">
            {(["pendentes", "pagas", "todas"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-full border px-3 py-1 font-sans text-[11px] capitalize transition-colors",
                  filtro === f
                    ? "border-neon-red/40 bg-neon-red/10 text-neon-red"
                    : "border-white/10 text-white/40 hover:text-white",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/6">
          {lista.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Receipt className="size-4 text-white/40" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-display text-xs font-bold text-white">
                    {f.clienteNome}
                  </div>
                  {f.cupom && (
                    <span className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 font-sans text-[10px] font-semibold text-neon-cyan">
                      {f.cupom} · {f.desconto}% OFF
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-white/30">
                  {f.numero} · vence {dataBr(f.vencimento)}
                </div>
              </div>
              <span className="font-display text-sm font-bold text-white">
                {f.desconto > 0 && (
                  <span className="mr-2 font-sans text-[11px] font-medium text-white/30 line-through">
                    {brl(f.valor)}
                  </span>
                )}
                {brl(f.valorFinal)}
              </span>
              <span
                className={cn(
                  "w-20 shrink-0 rounded-full border px-2 py-1 text-center font-sans text-[10px] uppercase tracking-widest",
                  statusStyle[f.status],
                )}
              >
                {f.status}
              </span>
              <button
                type="button"
                disabled={baixa.isPending}
                onClick={() =>
                  baixa.mutate({ id: f.id, pago: f.status !== "pago" })
                }
                className="rounded-lg border border-white/10 px-2.5 py-1.5 font-sans text-[11px] text-white/45 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                {f.status === "pago" ? "Reabrir" : "Dar baixa"}
              </button>
              {f.status !== "pago" && (
                <a
                  href={whatsappLink(
                    f.cupom
                      ? `Olá ${f.clienteNome}! Sua fatura ${f.numero} está em aberto. Com o cupom ${f.cupom} (${f.desconto}% OFF) da sua Jornada, o valor fica ${brl(f.valorFinal)} em vez de ${brl(f.valor)}.`
                      : `Olá ${f.clienteNome}! Passando para lembrar da fatura ${f.numero}, de ${brl(f.valorFinal)}, na PLAYPLUSNOW.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <NeonButton accent="red" variant="outline" size="sm">
                    Cobrar
                  </NeonButton>
                </a>
              )}
            </div>
          ))}
          {lista.length === 0 && (
            <p className="px-5 py-6 font-sans text-sm text-white/35">
              Nenhuma fatura aqui.
            </p>
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
  const eu = useEu();
  const contas = useContas();
  const clientes = useUsuarios();
  const pacotes = usePacotes();
  const aplicativos = useAplicativos();
  const suporte = useResumoSuporte();
  const gamificacao = useResumoRecompensas();
  const codigos = useCodigos();
  const filaTv = useFilaTvNetflix();
  const alertas = useAlertasAdmin();
  const estoqueGift = useResumoEstoqueGift();

  const esgotadas = (contas.data ?? []).filter(
    (c) => c.vagasOcupadas >= c.totalVagas,
  ).length;
  const pendentesSuporte =
    (suporte.data?.abertos ?? 0) + (suporte.data?.emAndamento ?? 0);
  const aVencer = (clientes.data ?? []).filter(
    (c) => c.statusPagamento !== "ativo",
  ).length;
  const avisosGamificacao = gamificacao.data?.avisosPendentes ?? 0;

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
    {
      id: "aplicativos",
      label: "Aplicativos",
      icon: Smartphone,
      badge: aplicativos.data ? String(aplicativos.data.length) : undefined,
    },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "gestaocontas", label: "Gestão de Contas", icon: Wallet },
    {
      id: "estoquegift",
      label: "Estoque de Gift Cards",
      icon: Ticket,
      badge: estoqueGift.data?.totais.disponivelQtd
        ? String(estoqueGift.data.totais.disponivelQtd)
        : undefined,
    },
    { id: "saude", label: "Saúde & Estoque", icon: HeartPulse },
    { id: "jogos", label: "Futebol Ao Vivo", icon: Goal },
    { id: "winback", label: "Recuperação", icon: HeartHandshake },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    {
      id: "afiliados",
      label: "Afiliados/Gamificação",
      icon: Trophy,
      badge: avisosGamificacao ? String(avisosGamificacao) : undefined,
    },
    {
      id: "suporte",
      label: "Suporte",
      icon: LifeBuoy,
      badge: pendentesSuporte ? String(pendentesSuporte) : undefined,
    },
    {
      id: "faturas",
      label: "Faturas",
      icon: Receipt,
      badge: aVencer ? String(aVencer) : undefined,
    },
    {
      id: "codigos",
      label: "Central de Códigos",
      icon: KeyRound,
      badge: codigos.data?.length ? String(codigos.data.length) : undefined,
    },
    {
      id: "netflixtv",
      label: "Solicitações TV Netflix",
      icon: Tv,
      badge: filaTv.data?.pendentes ? String(filaTv.data.pendentes) : undefined,
    },
    {
      id: "alertas",
      label: "Central de Alertas",
      icon: BellRing,
      badge: alertas.data?.naoLidas ? String(alertas.data.naoLidas) : undefined,
    },
    { id: "senhas", label: "Senhas & Acesso", icon: KeyRound },
    { id: "manual", label: "Manual do Admin", icon: BookOpen },
  ];

  const titles: Record<string, { title: string; sub: string }> = {
    visao: {
      title: "Visão Geral",
      sub: "Saúde da operação, direto do banco de dados.",
    },
    estoque: {
      title: "Gestão de Estoque / Contas Matrizes",
      sub: "Lotação real, clientes vinculados e alertas de vencimento de cada matriz.",
    },
    pacotes: {
      title: "Pacotes",
      sub: "Combos vendidos: nome, preço e serviços incluídos.",
    },
    aplicativos: {
      title: "Catálogo de Aplicativos",
      sub: "Cadastre os apps disponíveis. Eles alimentam os pacotes e as contas matrizes.",
    },
    suporte: {
      title: "Suporte",
      sub: "Problemas relatados pelos clientes — resolva e responda direto daqui.",
    },
    clientes: {
      title: "Clientes",
      sub: "Base completa de assinantes e seus pacotes.",
    },
    marketing: {
      title: "Marketing",
      sub: "Biblioteca de textos prontos para WhatsApp e redes sociais.",
    },
    gestaocontas: {
      title: "Gestão de Contas",
      sub: "Saldo de gift card de cada matriz, custo mensal, alerta de saldo crítico e os parâmetros do negócio.",
    },
    estoquegift: {
      title: "Estoque de Gift Cards",
      sub: "Códigos comprados e ainda não resgatados, saldo disponível por provedor e aplicação direta nas contas matrizes.",
    },
    saude: {
      title: "Saúde & Estoque",
      sub: "Contas que estão falhando, entrada pausada automaticamente, remanejamento para reserva e alerta de estoque no limite.",
    },
    jogos: {
      title: "Futebol Ao Vivo",
      sub: "Pool de contas do adicional. A liberação para o cliente é automática — você só mantém o pool abastecido.",
    },
    winback: {
      title: "Recuperação de Clientes",
      sub: "Régua automática de win-back: quem saiu há mais de 15 dias entra na fila com cupom pronto.",
    },
    afiliados: {
      title: "Afiliados / Gamificação",
      sub: "Quem indicou quem, XP acumulado, níveis e prêmios liberados — tudo calculado automaticamente.",
    },
    faturas: {
      title: "Faturas",
      sub: "Cobranças a vencer, recebimentos e inadimplência.",
    },
    codigos: {
      title: "Central de Códigos",
      sub: "Códigos de verificação dos streamings, extraídos do e-mail e entregues ao cliente. Expiram em 1 hora.",
    },
    netflixtv: {
      title: "Solicitações de TV Netflix",
      sub: "Códigos do netflix.com/tv2 enviados pelos clientes. Aprove em 1 clique e a TV deles libera na hora.",
    },
    alertas: {
      title: "Central de Alertas",
      sub: "Fila automática de tudo que exige ação: códigos pedidos, desbloqueio de TV, vencimentos próximos e clientes atrasados.",
    },
    senhas: {
      title: "Senhas & Acesso",
      sub: "Pedidos de 'esqueci minha senha'. O cliente recebe o link por e-mail automaticamente — aqui você acompanha e gera link manual quando precisar.",
    },
    manual: {
      title: "Manual do Admin",
      sub: "Guia operacional completo do painel — como cada módulo funciona e o que fazer em cada situação.",
    },
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
        user={{
          name: "Central PPN",
          email: "admin@playplusnow.com",
          initials: "PN",
        }}
      >
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {titles[active].title}
                </h1>
                <Ajuda
                  ajuda={`secao.${active}`}
                  lado="bottom"
                  className="size-[18px] text-[11px]"
                />
              </div>
              <p className="mt-1.5 font-sans text-sm text-white/40">
                {titles[active].sub}
              </p>
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
          {active === "aplicativos" && <AppsView />}
          {active === "afiliados" && (
            <>
              <AfiliadosView />
              <ComissoesView />
            </>
          )}
          {active === "gestaocontas" && <GestaoContasView />}
          {active === "estoquegift" && <EstoqueGiftView />}
          {active === "saude" && <SaudeView />}
          {active === "jogos" && <JogosView />}
          {active === "winback" && <RecuperacaoView />}
          {active === "marketing" && <MarketingView />}
          {active === "suporte" && <SuporteView />}
          {active === "faturas" && (
            <>
              <InvoicesAdminView />
              <PixView />
            </>
          )}
          {active === "codigos" && <CodigosView />}
          {active === "netflixtv" && <NetflixTvView />}
          {active === "alertas" && <AlertasView onIr={setActive} />}
          {active === "senhas" && <SenhasView />}
          {active === "manual" && <ManualView />}
        </div>
      </PanelShell>

      {/* Copiloto Admin — assistente de IA exclusivo desta area */}
      <CopilotoAdmin nome={eu.data?.nome} />
    </div>
  );
}

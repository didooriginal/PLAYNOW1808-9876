import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  HelpCircle,
  LifeBuoy,
  Loader2,
  Trophy,
  LayoutGrid,
  MessageCircle,
  Receipt,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "../components/app-icon";
import { RelatarProblema } from "../components/cliente/relatar-problema";
import { ComoAcessarModal } from "../components/cliente/como-acessar";
import { InstalarApp } from "../components/cliente/instalar-app";
import { AssistenteIA } from "../components/cliente/assistente";
import { SuporteClienteView } from "../components/cliente/suporte-view";
import { JornadaCliente } from "../components/cliente/jornada";
import { CodigoRecente } from "../components/cliente/codigo-recente";
import { CombosSugeridos } from "../components/cliente/combos-sugeridos";
import { PanelShell, type NavItem } from "../components/panel-shell";
import { GlassCard, NeonButton, Pill, ProgressBar, accentHex, NeonBackdrop } from "../components/ui/kit";
import {
  brl,
  clientNews,
  retailOf,
  serviceById,
  upgrades,
  whatsappLink,
  type ServiceId,
} from "@/lib/mock-data";
import { servicoInfo } from "@/lib/servicos-info";
import { usePainelCliente } from "../queries/usuarios";
import { useMeusChamados } from "../queries/suporte";
import { useMinhasFaturas, rotuloCompetencia, dataBr } from "../queries/faturas";

/** dados vindos do banco (usuarios.painel) */
type PainelCliente = NonNullable<ReturnType<typeof usePainelCliente>["data"]>;
type Acesso = PainelCliente["acessos"][number];
type Cliente = PainelCliente["cliente"];
type PacoteContratado = PainelCliente["pacote"];

/* ------------------------------------------------------------------ */

function AccessCard({ cred }: { cred: Acesso }) {
  const service = serviceById(cred.servico);
  const info = servicoInfo(cred.servico, service.name);
  const [revealed, setRevealed] = useState(false);
  const [guia, setGuia] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  function copy(kind: "email" | "password", value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const down = cred.status === "manutencao";
  const aguardando = cred.aguardando;

  return (
    <GlassCard
      hover
      className="relative flex flex-col overflow-hidden p-5"
      style={{ borderColor: `${service.color}33` }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${service.color}33 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AppIcon id={cred.servico} size="md" active={!aguardando} />
          <div>
            <button
              type="button"
              onClick={() => setGuia(true)}
              className="text-left font-display text-base font-bold text-white transition-colors hover:text-neon-cyan"
            >
              {service.name}
            </button>
            <div className="mt-0.5 font-sans text-[11px] text-white/35">
              Acesso individual · {cred.regiao}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 font-sans text-[10px] uppercase tracking-widest",
            down || aguardando
              ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
              : "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
          )}
        >
          {down || aguardando ? (
            <TriangleAlert className="size-3" />
          ) : (
            <BadgeCheck className="size-3" />
          )}
          {aguardando ? "liberando" : down ? "manutenção" : "ativo"}
        </span>
      </div>

      {/* credenciais */}
      {aguardando ? (
        <div className="relative mt-5 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-center">
          <p className="font-display text-xs font-bold text-amber-200">
            Estamos preparando o seu acesso
          </p>
          <p className="mt-1 font-sans text-[11px] text-white/50">
            Em instantes o login deste app aparece aqui.
          </p>
        </div>
      ) : (
      <div className="relative mt-5 space-y-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
            E-mail de acesso
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/75">
              {cred.email}
            </span>
            <button
              type="button"
              onClick={() => copy("email", cred.email)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label="Copiar e-mail"
            >
              {copied === "email" ? (
                <Check className="size-3.5 text-neon-cyan" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">Senha</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-mono text-xs transition-all",
                revealed ? "text-white/85" : "select-none text-white/30 blur-[3px]",
              )}
            >
              {revealed ? cred.senha : "••••••••••••"}
            </span>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-neon-red/50 hover:text-neon-red"
              aria-label={revealed ? "Ocultar senha" : "Ver senha"}
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => copy("password", cred.senha)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label="Copiar senha"
            >
              {copied === "password" ? (
                <Check className="size-3.5 text-neon-cyan" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* acesso direto + guia */}
      <div className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={aguardando}
          onClick={(e) => {
            if (aguardando) e.preventDefault();
          }}
          className={cn("min-w-0", aguardando && "pointer-events-none opacity-40")}
          data-testid="abrir-servico"
        >
          <NeonButton accent="red" size="sm" className="w-full !px-3">
            <span className="min-w-0 truncate">
              {info.rotulo.length > 15 ? "Abrir" : info.rotulo}
            </span>
            <ExternalLink className="size-3.5 shrink-0" />
          </NeonButton>
        </a>
        <NeonButton
          accent="cyan"
          variant="outline"
          size="sm"
          className="w-full !px-3"
          onClick={() => setGuia(true)}
          data-testid="como-acessar"
        >
          <HelpCircle className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">Como acessar</span>
        </NeonButton>
      </div>

      <div className="relative mt-3 border-t border-white/8 pt-3">
        <RelatarProblema servico={cred.servico} contaId={cred.contaId} />
      </div>

      {guia && (
        <ComoAcessarModal
          slug={cred.servico}
          nome={service.name}
          cor={service.color}
          onClose={() => setGuia(false)}
        />
      )}
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function diasRestantes(data: string) {
  const [d, m, y] = data.split("/").map(Number);
  if (!d || !m || !y) return 0;
  const alvo = new Date(y, m - 1, d).getTime();
  return Math.max(0, Math.round((alvo - Date.now()) / 86_400_000));
}

function ActivePlanCard({
  cliente,
  pacote,
  apps,
}: {
  cliente: Cliente;
  pacote: PacoteContratado;
  apps: number;
}) {
  const daysLeft = diasRestantes(cliente.proximaCobranca);
  const usedDays = 30 - (daysLeft % 30);
  const economia = Math.max(
    0,
    retailOf((pacote?.servicos ?? []) as ServiceId[]) - cliente.valor,
  );

  return (
    <GlassCard strong accent="red" className="relative overflow-hidden p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,31,61,0.28) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-400" />
              <span className="relative size-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/45">
              Pacote ativo
            </span>
          </div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {pacote?.nome ?? "Sem pacote"}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill accent="cyan">{apps} apps liberados</Pill>
            <Pill accent="purple">Ciclo {cliente.ciclo}</Pill>
            <Pill accent="red">
              {brl(cliente.valor)}/{cliente.ciclo === "anual" ? "ano" : "mês"}
            </Pill>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {[
              { label: "Cliente desde", value: cliente.clienteDesde || "—", icon: CalendarClock },
              { label: "Próxima cobrança", value: cliente.proximaCobranca || "—", icon: Wallet },
              { label: "Economia mensal", value: brl(economia), icon: TrendingUp },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-white/30">
                  <m.icon className="size-3" />
                  {m.label}
                </div>
                <div className="mt-1 font-display text-sm font-bold text-white">{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:w-72">
          <div className="flex items-baseline justify-between">
            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-white/40">
              Ciclo atual
            </span>
            <span className="font-display text-sm font-bold text-neon-cyan">
              {daysLeft} dias
            </span>
          </div>
          <ProgressBar value={usedDays} max={30} className="mt-3" />
          <p className="mt-2.5 font-sans text-[11px] text-white/35">
            Renova automaticamente em {cliente.proximaCobranca || "—"}
          </p>
          <a
            href={whatsappLink("Olá! Quero falar sobre o meu pacote na PLAPLUSNOW.")}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block"
          >
            <NeonButton accent="cyan" variant="outline" size="sm" className="w-full">
              <MessageCircle className="size-4" />
              Suporte no WhatsApp
            </NeonButton>
          </a>
        </div>
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function InvoicesView({ cliente }: { cliente: Cliente }) {
  // faturas reais, geradas no servidor a partir do historico do cliente.
  // O cupom da Jornada (3 renovacoes em dia = 15% OFF) ja vem aplicado na
  // fatura em aberto.
  const { data, isPending, isError, error } = useMinhasFaturas();

  if (isPending || isError || !data) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="font-sans text-sm text-white/45">
          {isPending
            ? "Carregando faturas..."
            : (error?.message ?? "Não foi possível carregar suas faturas.")}
        </p>
      </GlassCard>
    );
  }

  const { faturas, aberta, totalPago, quitadas, economia } = data;
  const cupom = aberta?.cupom ?? "";
  const desconto = aberta?.desconto ?? 0;

  const statusStyle: Record<string, string> = {
    pago: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
    aberto: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    vencido: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Fatura em aberto",
            value: aberta ? brl(aberta.valorFinal) : "Tudo em dia",
            sub: aberta
              ? cupom
                ? `${brl(aberta.valor)} - ${desconto}% de desconto`
                : `vence em ${dataBr(aberta.vencimento)}`
              : "nenhuma cobrança pendente",
            accent: "red" as const,
          },
          {
            label: "Total pago",
            value: brl(totalPago),
            sub: `${quitadas} ${quitadas === 1 ? "fatura quitada" : "faturas quitadas"}`,
            accent: "cyan" as const,
          },
          {
            label: "Economia com a Jornada",
            value: brl(economia),
            sub: economia > 0 ? "descontos já aplicados" : "conquiste cupons na Jornada",
            accent: "purple" as const,
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

      {cupom && aberta && (
        <GlassCard accent="red" className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neon-red/40 bg-neon-red/10">
            <Gift className="size-5 text-neon-red" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-white">
              Cupom da Jornada aplicado nesta fatura
            </div>
            <div className="mt-0.5 font-sans text-[11px] text-white/45">
              Você conquistou {desconto}% OFF com suas renovações em dia. O desconto já está na
              cobrança de {dataBr(aberta.vencimento)}.
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-bold tracking-widest text-neon-red">{cupom}</div>
            <div className="font-sans text-[11px] text-white/35 line-through">
              {brl(aberta.valor)}
            </div>
            <div className="font-display text-lg font-extrabold text-white">
              {brl(aberta.valorFinal)}
            </div>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="font-display text-sm font-bold text-white">Histórico de faturas</div>
          <span className="font-sans text-[11px] text-white/30">
            cliente desde {cliente.clienteDesde || "—"}
          </span>
        </div>
        <div className="divide-y divide-white/6">
          {faturas.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Receipt className="size-4 text-white/40" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-semibold text-white">
                  {rotuloCompetencia(inv.competencia)}
                </div>
                <div className="font-mono text-[11px] text-white/30">{inv.numero}</div>
              </div>
              <div className="hidden w-32 font-sans text-xs text-white/40 sm:block">
                {inv.cupom ? `${inv.cupom} · ${inv.desconto}% OFF` : "sem desconto"}
              </div>
              <div className="w-24 font-sans text-xs text-white/40">{dataBr(inv.vencimento)}</div>
              <div className="w-28 text-right font-display text-sm font-bold text-white">
                {inv.desconto > 0 && (
                  <span className="mr-1.5 font-sans text-[11px] font-medium text-white/30 line-through">
                    {brl(inv.valor)}
                  </span>
                )}
                {brl(inv.valorFinal)}
              </div>
              <span
                className={cn(
                  "w-24 shrink-0 rounded-full border px-2 py-1 text-center font-sans text-[10px] uppercase tracking-widest",
                  statusStyle[inv.status],
                )}
              >
                {inv.status}
              </span>
              {inv.status === "pago" ? (
                <span className="font-sans text-[11px] text-white/25">
                  pago em {dataBr(inv.pagoEm)}
                </span>
              ) : (
                <a
                  href={whatsappLink(
                    `Olá! Quero pagar a fatura ${inv.numero} de ${brl(inv.valorFinal)} da PLAPLUSNOW.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <NeonButton accent="red" size="sm">
                    Pagar
                  </NeonButton>
                </a>
              )}
            </div>
          ))}
          {faturas.length === 0 && (
            <p className="px-5 py-6 font-sans text-sm text-white/35">
              Nenhuma fatura gerada ainda.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function UpgradesView() {
  return (
    <div className="space-y-5">
      <CombosSugeridos />
      <div className="grid gap-4 lg:grid-cols-2">
        {upgrades.map((u) => (
          <GlassCard key={u.title} accent={u.accent} hover className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <Pill accent={u.accent} icon={<Gift className="size-3" />}>
                {u.tag}
              </Pill>
              <span className="font-display text-sm font-bold" style={{ color: accentHex[u.accent] }}>
                {u.price}
              </span>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-white">{u.title}</h3>
            <p className="mt-2 flex-1 font-sans text-sm leading-relaxed text-white/50">
              {u.description}
            </p>
            <a
              href={whatsappLink(`Olá! Quero contratar: ${u.title} (${u.price}).`)}
              target="_blank"
              rel="noreferrer"
              className="mt-5"
            >
              <NeonButton accent={u.accent} variant="outline" size="sm" className="w-full">
                Quero este upgrade
                <ArrowUpRight className="size-4" />
              </NeonButton>
            </a>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5">
        <div className="font-display text-sm font-bold text-white">Novidades da plataforma</div>
        <div className="mt-4 space-y-4">
          {clientNews.map((n) => (
            <div key={n.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="size-2 rounded-full bg-neon-cyan" style={{ boxShadow: "0 0 10px #22d3ee" }} />
                <span className="mt-1 w-px flex-1 bg-white/10" />
              </div>
              <div className="pb-1">
                <div className="font-sans text-[11px] uppercase tracking-widest text-white/30">
                  {n.date}
                </div>
                <div className="mt-0.5 font-display text-sm font-semibold text-white">{n.title}</div>
                <p className="mt-1 font-sans text-xs leading-relaxed text-white/45">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [active, setActive] = useState("acessos");
  const { data, isPending, isError, error } = usePainelCliente();
  const chamados = useMeusChamados();
  const abertos = (chamados.data ?? []).filter((c) => c.status !== "resolvido").length;

  const nav: NavItem[] = useMemo(
    () => [
      {
        id: "acessos",
        label: "Meus Acessos",
        icon: LayoutGrid,
        badge: data ? String(data.acessos.length) : undefined,
      },
      { id: "jornada", label: "Jornada / Recompensas", icon: Trophy },
      { id: "novidades", label: "Novidades/Upgrades", icon: Sparkles, badge: String(upgrades.length) },
      { id: "faturas", label: "Faturas", icon: Receipt },
      {
        id: "suporte",
        label: "Suporte",
        icon: LifeBuoy,
        badge: abertos ? String(abertos) : undefined,
      },
    ],
    [data, abertos],
  );

  if (isPending || isError || !data) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <NeonBackdrop />
        <GlassCard strong accent={isError ? "red" : "cyan"} className="relative max-w-md p-8 text-center">
          {isPending ? (
            <>
              <Loader2 className="mx-auto size-6 animate-spin text-neon-cyan" />
              <p className="mt-4 font-display text-sm font-bold text-white">
                Carregando seus acessos...
              </p>
              <p className="mt-1 font-sans text-xs text-white/40">Buscando dados no banco.</p>
            </>
          ) : (
            <>
              <TriangleAlert className="mx-auto size-6 text-neon-red" />
              <p className="mt-4 font-display text-sm font-bold text-white">
                {isError ? "Não foi possível carregar o painel" : "Nenhum cliente cadastrado"}
              </p>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-white/45">
                {isError
                  ? error?.message
                  : "Cadastre um cliente no Painel do Administrador para ver os acessos aqui."}
              </p>
            </>
          )}
        </GlassCard>
      </div>
    );
  }

  const { cliente, pacote, acessos } = data;
  const initials = cliente.nome
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="relative min-h-screen">
      <NeonBackdrop />
      <PanelShell
        nav={nav}
        active={active}
        onNavigate={setActive}
        accent="red"
        role={`Cliente · ${cliente.statusPagamento}`}
        user={{ name: cliente.nome, email: cliente.email, initials }}
      >
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {active === "acessos" && "Meus Acessos"}
              {active === "jornada" && "Jornada do Cliente"}
              {active === "novidades" && "Novidades e Upgrades"}
              {active === "faturas" && "Minhas Faturas"}
              {active === "suporte" && "Suporte"}
            </h1>
            <p className="mt-1.5 font-sans text-sm text-white/40">
              {active === "acessos" &&
                "Login e senha de cada app do seu pacote. Nunca troque a senha da conta matriz."}
              {active === "jornada" &&
                "Suba de nível, cumpra missões e desbloqueie prêmios indicando amigos."}
              {active === "novidades" && "Novos apps, telas extras e formas de pagar menos."}
              {active === "faturas" && "Acompanhe pagamentos, vencimentos e recibos."}
              {active === "suporte" && "Relate um problema e acompanhe o andamento do chamado."}
            </p>
          </div>

          {active === "acessos" && (
            <>
              <ActivePlanCard cliente={cliente} pacote={pacote} apps={acessos.length} />
              <CodigoRecente />
              {acessos.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {acessos.map((cred) => (
                    <AccessCard key={cred.servico} cred={cred} />
                  ))}
                </div>
              ) : (
                <GlassCard className="p-10 text-center">
                  <TriangleAlert className="mx-auto size-6 text-white/25" />
                  <p className="mt-3 font-sans text-sm text-white/40">
                    Nenhuma conta matriz cadastrada para os apps do seu pacote.
                  </p>
                </GlassCard>
              )}
            </>
          )}

          {active === "acessos" && <InstalarApp />}

          {active === "jornada" && <JornadaCliente />}
          {active === "novidades" && <UpgradesView />}
          {active === "faturas" && <InvoicesView cliente={cliente} />}
          {active === "suporte" && <SuporteClienteView />}
        </div>
      </PanelShell>
      <AssistenteIA cliente={{ nome: cliente.nome, apps: acessos.length }} />
    </div>
  );
}

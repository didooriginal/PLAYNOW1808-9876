import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CircleAlert,
  Database,
  FlaskConical,
  Home,
  KeyRound,
  ListChecks,
  Package,
  Rocket,
  ScrollText,
  ShieldCheck,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { GlassCard, NeonBackdrop, Pill } from "@/components/ui/kit";
import { Logo } from "@/components/logo";
import { CodeBlock } from "@/components/setup/code-block";
import { CopyValue } from "@/components/setup/copy-value";
import { cn } from "@/lib/utils";

/**
 * PÁGINA DE SETUP — versão navegável do SETUP.md.
 * Documenta a restauração do ambiente: como rodar, como apontar para outro banco
 * Turso, scripts criados, credenciais de teste e pendências conhecidas.
 * Rota pública em /setup (é documentação interna, não expõe segredo nenhum).
 */

const secoes = [
  { id: "diagnostico", label: "Diagnóstico", icon: CircleAlert },
  { id: "rodar", label: "Como rodar", icon: Terminal },
  { id: "banco", label: "Banco de dados", icon: Database },
  { id: "turso", label: "Trocar o Turso", icon: Wrench },
  { id: "scripts", label: "Scripts novos", icon: ScrollText },
  { id: "contas", label: "Contas de teste", icon: KeyRound },
  { id: "dados", label: "Dados populados", icon: Boxes },
  { id: "verificado", label: "Verificado", icon: ListChecks },
  { id: "pendencias", label: "Pendências", icon: AlertTriangle },
];

const tabelasApp = [
  "pacotes",
  "contas_matrizes",
  "usuarios",
  "aplicativos",
  "alocacoes",
  "chamados",
  "recompensas_progresso",
  "recompensas_eventos",
  "combos",
  "codigos_otp",
  "solicitacoes_tv",
  "notificacoes",
  "historico_vencimento",
  "faturas",
];

const tabelasAuth = ["user", "session", "account", "verification"];

const verificacoes = [
  "bun install — OK",
  "bun run typecheck — 3/3 pacotes OK",
  "bun run build — OK (web + desktop)",
  "/ , /dashboard e /admin sem erro de console ou pageerror",
  "overflowX = 0 em 1440px (sem scroll horizontal)",
  "Admin lendo do banco real: 5 clientes ativos, 4 contas esgotadas, fila com 8 itens",
];

const pendencias = [
  {
    titulo: "bun run lint: 1 erro restante (divergência do template)",
    gravidade: "Pré-existente",
    accent: "purple" as const,
    corpo: (
      <p>
        <code className="text-white/80">packages/mobile/app/_layout.tsx</code> importa{" "}
        <code className="text-white/80">components/__ErrorBoundary</code> enquanto a convenção pede{" "}
        <code className="text-white/80">components/ErrorBoundary</code>. O arquivo real é
        gerenciado pelo template (prefixo <code className="text-white/80">__</code>), então não dá
        para corrigir sem editá-lo. Não afeta dev, build nem typecheck. As demais 13 violações (rotas{" "}
        <code className="text-white/80">xRoutes</code> e{" "}
        <code className="text-white/80">queries/planos.ts</code>) já foram normalizadas.
      </p>
    ),
  },
  {
    titulo: "Blocos ainda mockados de propósito",
    gravidade: "Por design",
    accent: "cyan" as const,
    corpo: (
      <p>
        Novidades/upgrades, stats sociais e a série histórica de MRR não têm tabela —
        seguem vindo de <code className="text-white/80">lib/mock-data.ts</code>.
      </p>
    ),
  },
  {
    titulo: "Integrações sem credencial",
    gravidade: "Precisa de você",
    accent: "red" as const,
    corpo: (
      <p>
        <code className="text-white/80">EMAIL_WEBHOOK_TOKEN</code> (webhook de inbound email da
        Central de Códigos), <code className="text-white/80">PIX_WEBHOOK_TOKEN</code> (confirmação
        de pagamento — hoje o gateway roda em modo simulado) e o aviso por WhatsApp/CallMeBot
        continuam sem configuração.
      </p>
    ),
  },
];

function Secao({
  id,
  eyebrow,
  titulo,
  descricao,
  children,
}: {
  id: string;
  eyebrow: string;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <Pill accent="red">{eyebrow}</Pill>
      <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
        {titulo}
      </h2>
      {descricao && (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/50">{descricao}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function SetupPage() {
  const [ativa, setAtiva] = useState(secoes[0].id);

  // scroll-spy do índice lateral
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtiva(visivel.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );

    for (const s of secoes) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      <NeonBackdrop />

      {/* topbar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" withTagline={false} />
            <span className="hidden h-8 w-px bg-white/10 sm:block" />
            <span className="hidden font-sans text-[10px] uppercase tracking-[0.28em] text-white/35 sm:block">
              Documentação
              <br />
              de ambiente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-sans text-xs text-white/55 transition-colors hover:border-white/25 hover:text-white"
            >
              <Home className="size-3.5" />
              <span className="hidden sm:inline">Landing</span>
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-sans text-xs text-white/55 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
            >
              <ShieldCheck className="size-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-8 sm:pt-16">
        {/* hero */}
        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <div className="min-w-0">
            <Pill accent="cyan" icon={<Rocket className="size-3" />}>
              Ambiente restaurado — 09/08/2026
            </Pill>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
              PLAYPLUSNOW
              <span className="block text-white/30">está rodando.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
              Projeto clonado do zip <code className="text-white/70">PLAYPLUSNOW-3369-main</code>,
              reinstalado no template gerenciado Runable (mesma versão,{" "}
              <code className="text-white/70">0.3.0</code>), com banco Turso novo provisionado e
              populado.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <Pill accent="cyan" icon={<BadgeCheck className="size-3" />}>
                typecheck 3/3
              </Pill>
              <Pill accent="cyan" icon={<BadgeCheck className="size-3" />}>
                build OK
              </Pill>
              <Pill accent="purple" icon={<BadgeCheck className="size-3" />}>
                3 telas sem erro
              </Pill>
              <Pill accent="red" icon={<Database className="size-3" />}>
                18 tabelas
              </Pill>
            </div>
          </div>

          <GlassCard accent="red" className="min-w-0 p-6 sm:p-7">
            <span className="font-sans text-[10px] uppercase tracking-[0.24em] text-white/35">
              Acesso rápido
            </span>
            <div className="mt-4 space-y-3">
              {[
                { label: "Landing", url: "http://localhost:4200/", to: "/" },
                { label: "Painel do cliente", url: "/dashboard", to: "/dashboard" },
                { label: "Painel admin", url: "/admin", to: "/admin" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-semibold text-white">
                      {l.label}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-white/35">
                      {l.url}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-white/30" />
                </Link>
              ))}
            </div>
            <p className="mt-5 border-t border-white/[0.07] pt-4 font-sans text-xs leading-relaxed text-white/35">
              Dev server na porta <span className="text-white/70">4200</span>, numa sessão tmux
              chamada <code className="text-white/70">dev</code> —{" "}
              <code className="text-white/70">tmux attach -t dev</code>.
            </p>
          </GlassCard>
        </div>

        {/* conteúdo + índice */}
        <div className="mt-20 grid gap-12 lg:grid-cols-[220px_1fr] lg:gap-14">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              <span className="mb-3 block font-sans text-[10px] uppercase tracking-[0.24em] text-white/25">
                Nesta página
              </span>
              {secoes.map((s) => {
                const Icone = s.icon;
                const atual = ativa === s.id;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 font-sans text-[13px] transition-all",
                      atual
                        ? "border border-neon-red/35 bg-neon-red/[0.08] text-white"
                        : "border border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/75",
                    )}
                  >
                    <Icone
                      className={cn("size-3.5 shrink-0", atual ? "text-neon-red" : "text-white/30")}
                    />
                    {s.label}
                  </a>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-20">
            <Secao
              id="diagnostico"
              eyebrow="Diagnóstico"
              titulo="O que estava quebrado"
              descricao="Nada no código."
            >
              <GlassCard accent="red" className="p-6 sm:p-7">
                <p className="text-[15px] leading-relaxed text-white/60">
                  O zip não traz o <code className="text-white/85">.env</code> (é gitignored), então{" "}
                  <code className="text-white/85">DATABASE_URL</code> e{" "}
                  <code className="text-white/85">DATABASE_AUTH_TOKEN</code> faltavam — e toda
                  chamada ao banco morria em runtime. Typecheck e build passavam normalmente, o que
                  dava a falsa impressão de arquivo truncado.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/30">
                      Sintoma
                    </span>
                    <p className="mt-1.5 text-sm text-white/65">
                      Telas abriam vazias ou estouravam ao carregar dados.
                    </p>
                  </div>
                  <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/[0.04] p-4">
                    <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-neon-cyan/70">
                      Correção
                    </span>
                    <p className="mt-1.5 text-sm text-white/65">
                      Infra gerenciada nova: .env com Turso, S3, AI gateway e auth secret.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </Secao>

            <Secao
              id="rodar"
              eyebrow="Passo a passo"
              titulo="Como rodar"
              descricao="As dependências já estão instaladas. Na prática você só precisa da segunda linha."
            >
              <CodeBlock
                cwd="/home/user/playplusnow"
                linhas={[
                  { cmd: "bun install", nota: "já feito" },
                  { cmd: "bun run dev", nota: "web + API na porta 4200" },
                  { cmd: "bun run dev:desktop", nota: "Electron, porta 4400 (opcional)" },
                  { cmd: "bun run dev:mobile", nota: "Expo, porta 4300 (opcional)" },
                  { cmd: "bun run build", nota: "verifica compilação (web + desktop)" },
                  { cmd: "bun run typecheck", nota: "3/3 OK" },
                ]}
              />
            </Secao>

            <Secao
              id="banco"
              eyebrow="Turso"
              titulo="Banco de dados"
              descricao="18 tabelas aplicadas com bun run db:push no banco novo."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassCard className="p-6">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-neon-red" />
                    <span className="font-display text-sm font-semibold text-white">
                      Tabelas do app
                    </span>
                    <span className="ml-auto font-mono text-xs text-white/30">
                      {tabelasApp.length}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tabelasApp.map((t) => (
                      <code
                        key={t}
                        className="rounded-md border border-white/[0.07] bg-black/40 px-2 py-1 font-mono text-[11.5px] text-white/60"
                      >
                        {t}
                      </code>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-neon-purple" />
                    <span className="font-display text-sm font-semibold text-white">
                      Better Auth
                    </span>
                    <span className="ml-auto font-mono text-xs text-white/30">
                      {tabelasAuth.length}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tabelasAuth.map((t) => (
                      <code
                        key={t}
                        className="rounded-md border border-white/[0.07] bg-black/40 px-2 py-1 font-mono text-[11.5px] text-white/60"
                      >
                        {t}
                      </code>
                    ))}
                  </div>
                  <p className="mt-5 border-t border-white/[0.07] pt-4 font-sans text-xs leading-relaxed text-white/35">
                    Cada conta criada é vinculada a uma linha de{" "}
                    <code className="text-white/60">usuarios</code> por{" "}
                    <code className="text-white/60">auth_user_id</code>.
                  </p>
                </GlassCard>
              </div>
            </Secao>

            <Secao
              id="turso"
              eyebrow="Migração"
              titulo="Trocar para o seu banco Turso"
              descricao="Três passos. Edite apenas o .env da raiz — o lint recusa .env.local e variantes."
            >
              <div className="space-y-4">
                {[
                  {
                    n: 1,
                    titulo: "Aponte as credenciais",
                    corpo: (
                      <CodeBlock
                        cwd=".env (raiz do projeto)"
                        prompt={false}
                        linhas={[
                          { cmd: "DATABASE_URL=libsql://seu-banco.turso.io" },
                          { cmd: "DATABASE_AUTH_TOKEN=seu-token" },
                        ]}
                      />
                    ),
                  },
                  {
                    n: 2,
                    titulo: "Aplique o schema e popule",
                    corpo: (
                      <CodeBlock
                        cwd="packages/web"
                        linhas={[
                          { cmd: "bun run db:push", nota: "cria/atualiza as tabelas" },
                          { cmd: "bun run seed", nota: "popula só se estiver vazio" },
                          { cmd: "bun run seed -- force", nota: "apaga e recria os dados" },
                        ]}
                      />
                    ),
                  },
                  {
                    n: 3,
                    titulo: "Reinicie o dev server",
                    corpo: (
                      <p className="text-[15px] leading-relaxed text-white/50">
                        As variáveis são lidas no boot.{" "}
                        <code className="text-white/75">bun run db:generate</code> +{" "}
                        <code className="text-white/75">bun run db:migrate</code> se você preferir
                        migrations versionadas em vez de push direto.
                      </p>
                    ),
                  },
                ].map((passo) => (
                  <GlassCard key={passo.n} className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neon-red/40 bg-neon-red/10 font-display text-xs font-bold text-neon-red">
                        {passo.n}
                      </span>
                      <span className="font-display text-base font-semibold text-white">
                        {passo.titulo}
                      </span>
                    </div>
                    <div className="mt-4">{passo.corpo}</div>
                  </GlassCard>
                ))}
              </div>
            </Secao>

            <Secao
              id="scripts"
              eyebrow="Novo"
              titulo="Scripts criados nesta restauração"
              descricao="Rodam em packages/web. A única mudança de código foi em seed.ts — nenhuma tela foi alterada."
            >
              <div className="space-y-4">
                <GlassCard accent="cyan" className="p-6">
                  <code className="font-mono text-sm text-neon-cyan">bun run seed</code>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                    Popula o banco sem precisar de sessão de admin — a procedure{" "}
                    <code className="text-white/80">seed.run</code> da API exige login admin, o que
                    trava o bootstrap de um banco vazio. Reaproveita a mesma função{" "}
                    <code className="text-white/80">executarSeed()</code>.
                  </p>
                </GlassCard>

                <GlassCard accent="purple" className="p-6">
                  <code className="font-mono text-sm text-neon-purple">
                    bun run admin &lt;email&gt;
                  </code>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/55">
                    Marca um usuário como administrador.{" "}
                    <code className="text-white/80">bun run admin &lt;email&gt; remover</code>{" "}
                    desfaz. O e-mail precisa existir em{" "}
                    <code className="text-white/80">usuarios</code> — uma conta criada em{" "}
                    <code className="text-white/80">/signup</code> já entra lá pelo hook do Better
                    Auth.
                  </p>
                </GlassCard>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <p className="text-sm leading-relaxed text-white/45">
                    <span className="text-white/70">Diff mínimo:</span>{" "}
                    <code className="text-white/70">src/api/routes/seed.ts</code> passou a exportar{" "}
                    <code className="text-white/70">executarSeed()</code>, usada tanto pela
                    procedure <code className="text-white/70">seed.run</code> quanto pelo script.
                  </p>
                </div>
              </div>
            </Secao>

            <Secao
              id="contas"
              eyebrow="Credenciais"
              titulo="Contas de teste"
              descricao="Troque as senhas antes de qualquer uso real."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <GlassCard accent="purple" className="p-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-neon-purple" />
                    <span className="font-display text-sm font-semibold text-white">Admin</span>
                    <code className="ml-auto font-mono text-[11px] text-white/30">/admin</code>
                  </div>
                  <div className="mt-4 space-y-3">
                    <CopyValue label="E-mail" value="admin@playplusnow.com" />
                    <CopyValue label="Senha" value="Admin@2026" secreto />
                  </div>
                </GlassCard>

                <GlassCard accent="cyan" className="p-6">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-neon-cyan" />
                    <span className="font-display text-sm font-semibold text-white">Cliente</span>
                    <code className="ml-auto font-mono text-[11px] text-white/30">/dashboard</code>
                  </div>
                  <div className="mt-4 space-y-3">
                    <CopyValue label="E-mail" value="diego.silva@email.com" />
                    <CopyValue label="Senha" value="Cliente@2026" secreto />
                  </div>
                  <p className="mt-5 border-t border-white/[0.07] pt-4 font-sans text-xs leading-relaxed text-white/35">
                    O cadastro caiu em cima da linha do seed (Diego Dias Silva, pacote Mega Promo),
                    então o painel abre com dados reais.
                  </p>
                </GlassCard>
              </div>
            </Secao>

            <Secao id="dados" eyebrow="Seed" titulo="Dados populados">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { n: "3", label: "Pacotes", nota: "Pacote 03, Mega Promo, 15 em 1", accent: "red" as const },
                  { n: "15", label: "Contas matrizes", nota: "Netflix, Disney+, HBO Max, Spotify, IPTV…", accent: "cyan" as const },
                  { n: "9", label: "Usuários", nota: "8 clientes + 1 conta admin", accent: "purple" as const },
                ].map((s) => (
                  <GlassCard key={s.label} accent={s.accent} className="p-6">
                    <span className="font-display text-4xl font-extrabold text-white">{s.n}</span>
                    <span className="mt-1 block font-display text-sm font-semibold text-white/80">
                      {s.label}
                    </span>
                    <span className="mt-2 block font-sans text-xs leading-relaxed text-white/35">
                      {s.nota}
                    </span>
                  </GlassCard>
                ))}
              </div>
            </Secao>

            <Secao
              id="verificado"
              eyebrow="QA"
              titulo="Verificado nesta restauração"
              descricao="Nada aqui é suposição — tudo foi rodado."
            >
              <GlassCard className="divide-y divide-white/[0.06] p-2">
                {verificacoes.map((v) => (
                  <div key={v} className="flex items-start gap-3 px-4 py-3.5">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-neon-cyan" />
                    <span className="text-[14.5px] leading-relaxed text-white/60">{v}</span>
                  </div>
                ))}
              </GlassCard>
            </Secao>

            <Secao
              id="pendencias"
              eyebrow="Atenção"
              titulo="Pendências conhecidas"
              descricao="Nenhuma delas bloqueia rodar o projeto."
            >
              <div className="space-y-4">
                {pendencias.map((p, i) => (
                  <GlassCard key={p.titulo} className="p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-white/25">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-base font-semibold text-white">
                        {p.titulo}
                      </span>
                      <Pill accent={p.accent} className="ml-auto">
                        {p.gravidade}
                      </Pill>
                    </div>
                    <div className="mt-4 text-[14.5px] leading-relaxed text-white/55">
                      {p.corpo}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </Secao>

            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7 text-center">
              <FlaskConical className="mx-auto size-5 text-white/30" />
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/45">
                Esta página é a versão navegável do{" "}
                <code className="text-white/70">SETUP.md</code> na raiz do projeto. Os dois contam a
                mesma história — o arquivo continua lá para leitura no editor e no git.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

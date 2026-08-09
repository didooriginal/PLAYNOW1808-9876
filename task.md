# PLAPLUSNOW — interface web (mock, sem backend)

## Status: concluído

## Feito
- [x] `app_init` (Bun + Vite + React 19 + Tailwind 4 + Wouter)
- [x] Design system dark/glass/neon em `styles.css` (vermelho #ff1f3d, ciano #22d3ee, roxo #a855f7)
- [x] Fontes Sora + Outfit, `lang="pt-BR"`, `class="dark"`
- [x] Logo PLAY PLUS / NOW com stroke + glow
- [x] Mocks completos em `lib/mock-data.ts` (WhatsApp 5521964727746, dados fictícios)
- [x] Landing `/`: hero, comparativo de economia, toggle mensal/anual + 3 pacotes,
      montador à la carte com calculadora em tempo real, prova social, CTA, footer
- [x] Painel do cliente `/dashboard`: pacote ativo, Meus Acessos (ver/copiar senha),
      Novidades/Upgrades, Faturas
- [x] Painel admin `/admin`: KPIs, gráfico MRR, fila operacional, estoque de contas
      matrizes, clientes, faturas
- [x] Responsivo (checado em 1440 e 390)

## Correções na verificação visual
- [x] Hero: card do combo estourava a coluna do grid (`w-max` do marquee elevava o
      min-content do track fr) → `min-w-0` nas duas colunas
- [x] Admin: barras do gráfico MRR não renderizavam (altura em `%` dentro de flex-col
      sem altura definida) → altura em px calculada
- [x] Admin: nome do usuário truncado na sidebar → "Central PPN"

## Verificações
- `bun run typecheck` → 3/3 ok
- `bun run build` (web) → ok
- 3 rotas sem erro de console/pageerror, `overflowX = 0` em 1440 e 390
- dev server: tmux `dev`, porta 4200

## Notas
- `bun run lint` na raiz falha por inconsistência pré-existente do template em
  `packages/mobile/app/_layout.tsx` (arquivo `__ErrorBoundary.tsx`); nenhum arquivo
  mobile foi tocado. `oxlint` no web aborta com SIGABRT (crash do binário).

## Fase 2 — Backend real (concluída)
- Banco gerenciado Turso/SQLite + Drizzle (não Supabase — template Runable não permite trocar).
- Schema: `pacotes`, `contas_matrizes`, `usuarios` em src/api/database/schema.ts (`db:push` aplicado).
- Rotas oRPC: routes/pacotes.ts, contas.ts, usuarios.ts (inclui `painel` do cliente + `resumo`), seed.ts.
- Stores web: src/web/queries/{pacotes,contas,usuarios,seed}.ts.
- /dashboard e /admin consomem 100% do banco (mocks só para faturas, novidades, upgrades, série de MRR).
- Verificado: typecheck OK, build OK, screenshots OK, mutations (ajustarVagas/repor/criar) OK.

## Fase 3 — Retomada após a interrupção (07/08/2026)

### Diagnóstico
- Nenhum arquivo estava truncado: `bun run typecheck` (3/3) e `bun run build` passaram
  no código clonado como estava. Não havia `}` faltando nem componente quebrado.
- O que realmente faltava era **infraestrutura**: o repositório não traz `.env`
  (gitignored), então `DATABASE_URL`/`DATABASE_AUTH_TOKEN` estavam ausentes e todas as
  chamadas ao banco quebravam em runtime.
- E a **landing ainda lia pacotes do mock** (`lib/mock-data.ts`), última parte da
  integração que o dev anterior não terminou.

### Feito agora
- [x] `.env` provisionado (Turso gerenciado) e `db:push` aplicado → tabelas `pacotes`,
      `contas_matrizes`, `usuarios` criadas no banco real.
- [x] Nova coluna `pacotes.perks` (JSON de benefícios) — antes os perks só existiam no mock.
      Aplicada via `ALTER TABLE` (o `db:push` do drizzle-kit exige TTY para coluna NOT NULL).
- [x] `routes/pacotes.ts`: `perks` no schema de input (criar/atualizar).
- [x] `routes/seed.ts`: perks dos 3 pacotes; seed executado (3 pacotes, 15 contas, 8 usuários).
- [x] Novo `src/web/queries/planos.ts` — ponte banco → landing: converte `pacotes` para o
      tipo `Plan` usado pelos componentes (`usePlanos`, `usePlanoDestaque`), com fallback
      no catálogo estático enquanto carrega ou se a tabela estiver vazia.
- [x] `landing/plans.tsx`, `landing/hero.tsx`, `landing/savings.tsx` agora renderizam os
      pacotes do banco (antes eram constantes de módulo do mock).
- [x] Admin › Pacotes: formulário ganhou tagline, preço anual, vagas, benefícios e
      "pacote em destaque"; card lista os perks; rodapé do card com `flex-wrap`.

### Verificações (07/08/2026)
- `bun run typecheck` → 3/3 OK
- `bun run build` → OK (web + desktop)
- `/`, `/dashboard`, `/admin` sem erro de console/pageerror, `overflowX = 0` em 1440
- Mutations testadas via API: pacotes criar/remover (com perks), contas ajustarVagas/repor/atualizar,
  resumos de contas e usuários
- dev server: tmux `dev`, porta 4200

### Nota
- Mocks que continuam propositalmente sem tabela: faturas, novidades/upgrades, depoimentos,
  stats sociais, série histórica de MRR e catálogo de serviços (ícones/preço avulso).

---

## Fase — Gamificação, Indicações e Afiliados (08/08/2026)

### Banco
- `usuarios.referral_code` (unique) e `usuarios.indicado_por` (FK lógica p/ quem indicou).
- `recompensas_progresso`: XP, nível, renovações, indicações, meses ativo, missões,
  prêmios liberados/entregues, cupom ativo + desconto.
- `recompensas_eventos`: livro-razão idempotente (`chave` única por cliente), trilha de
  auditoria e origem das notificações do admin.

### Regras
- Nada é pontuado à mão: `recalcularProgresso(clienteId)` deriva tudo do histórico real
  (renovações a partir de `clienteDesde`, indicações convertidas = indicado com pacote e
  não inadimplente) e roda a cada carga de painel.
- +50 XP por renovação em dia · +150 XP por indicação que vira assinante · 250 XP por nível.
- Níveis: Iniciante → Bronze → Prata → Ouro → Platina → Diamante → Lenda PPN.
- 7 missões: m1 1 renovação · m2 3 renovações (cupom `PPN15OFF`, 15% OFF) · m3 5 renovações ·
  m4 1 indicação assinante · m5 3 indicações (HBO Max grátis) · m6 10 renovações ·
  m7 12 meses ativo (presente surpresa). m5/m6/m7 notificam o admin.

### Telas
- `/dashboard` › **Jornada / Recompensas**: barra de nível, trilha de missões 1–7,
  painel de prêmios e link de indicação (`/signup?ref=CODIGO`) com copiar + WhatsApp.
- `/signup?ref=`: valida o código, mostra "Você foi indicado por X" e grava `indicadoPor`.
- `/admin` › **Afiliados/Gamificação**: KPIs, avisos de marcos, quem indicou quem, XP,
  prêmios liberados (clique = marcar entregue).
- **Faturas**: cupom de 15% aplicado na fatura em aberto do cliente (banner + valor com
  desconto) e nas cobranças pendentes do admin (badge, valor riscado, texto do WhatsApp).

### Verificações
- `bun run typecheck` OK · `bun run build` OK
- E2E Playwright: cliente (Jornada, Faturas) e admin (Afiliados, Faturas) com `errors: []`
- `/signup?ref=DIEGOK26K` → banner + cadastro gravando `indicadoPor`

### Dados de demonstração
- Camila Ribeiro, Lucas Ferraz e Juliana Prado foram vinculados como indicados do
  Diego (id 9) só para a aba Afiliados não nascer vazia — pode ser removido a pedido.

## Fase 8 — Faturas reais (fim dos mocks de cobrança)

- Tabela `faturas` (`cliente_id + competencia` único) + rota `api/routes/faturas.ts`.
- `gerarFaturas()` deriva a série completa de `clienteDesde` + `ciclo` + `valor`; idempotente,
  roda a cada carga de painel. Passadas = `pago`, corrente = `aberto`/`vencido`.
- Cupom da Jornada reaplicado sempre na fatura em aberto mais recente.
- Cliente: histórico real, total pago, KPI "Economia com a Jornada", pagar via WhatsApp.
- Admin: KPIs sobre a tabela, filtro pendentes/pagas/todas, `Dar baixa`/`Reabrir`
  (reajusta `statusPagamento`), cobrança com valor já com desconto.
- Gráfico "Receita faturada" (`faturas.serie`) com receita reconhecida — plano anual
  rateado em 12 meses para não virar pico isolado.
- Mocks removidos de `lib/mock-data.ts`: `myInvoices`, `revenueSeries`, `adminStats`,
  `masterAccounts`, `adminClients`, `adminQueue`, `myAccess`, `currentUser` e os tipos
  órfãos. Restam só catálogo de serviços + conteúdo editorial da landing.

### Verificações
- `bun run typecheck` OK · `bun run build` OK · `db:push` aplicado
- E2E: landing, cliente (Faturas) e admin (Visão Geral, Faturas) com `errors: []`

## Fase 9 — Catálogo oficial (33 produtos), Combo Inteligente e Central de Códigos

### 1. Catálogo com preços oficiais e categorias
- `aplicativos.preco` (novo campo) = preço de venda PLAPLUSNOW. `precoAvulso` continua
  sendo o preço de mercado, usado só no comparativo de economia.
- `aplicativos.categoria`: `streaming | esportes | produtividade | musica | iptv | asiatico`.
- 33 produtos da tabela oficial cadastrados (21 novos + 14 atualizados). Total 35 linhas:
  `star` e `iptv` foram MANTIDOS porque `pacotes.servicos` e `contas_matrizes.servico`
  ainda apontam para eles — remover quebraria o histórico. Nunca deletados.
- Admin › Aplicativos: filtro por categoria + seções agrupadas, com preço PPN e avulso.

### 2. Combo Inteligente
- Tabela `combos` + `api/routes/combos.ts` (`vitrine` pública, `paraCliente`, `listar`,
  `criar`, `atualizar`, `remover`).
- `precoCheio` NUNCA é digitado: é a soma dos `aplicativos.preco` dos apps do combo,
  recalculada no servidor a cada gravação — o "de/por" e o % OFF são sempre reais.
- Admin: monta o combo marcando 2+ apps (mínimo validado no schema) e digitando o preço;
  toggles de visibilidade (landing / painel do cliente / ativo / destaque).
- Aparece nos três lugares pedidos: admin, landing (`#combos`) e painel do cliente
  (aba Novidades/Upgrades, como upgrade sugerido).
- 5 combos de demonstração semeados (Cinéfilo Total em destaque).

### 3. Central de Códigos (OTP)
- Tabela `codigos_otp` + `api/routes/codigos.ts`.
- Duas portas de entrada, mesmo pipeline:
  1. `POST /api/webhooks/email` — webhook genérico (aceita `from/to/subject/text` e os
     apelidos comuns dos provedores; header `x-webhook-token` se `EMAIL_WEBHOOK_TOKEN`).
  2. Colagem manual no admin — o parser lê as linhas `De:/Para:/Assunto:` do texto colado.
- Extração: busca número de 4 a 6 dígitos perto de rótulos ("código", "verification code",
  "OTP"...), depois padrão invertido, depois fallback ignorando o que parece ano.
- Serviço identificado pelo remetente/assunto (peso 2) ou corpo (peso 1), cruzando slug,
  nome e apelidos de domínio do catálogo.
- Cliente identificado pelo destinatário: e-mail do próprio cliente → dele; conta matriz
  com uma única vaga ativa → do ocupante; conta compartilhada → sem dono (admin vincula
  no dropdown).
- Limpeza automática: tudo com mais de 1 hora é apagado a cada leitura da central.
- Cliente: card "Seu código de acesso recente" no topo de Meus Acessos, com contagem de
  expiração e botão copiar. Vê códigos vinculados a ele OU endereçados a uma matriz em que
  tem vaga ativa — sem nunca expor o e-mail/senha da matriz.

### 4. Itens já entregues em fases anteriores (revalidados aqui)
- Gamificação: `/signup?ref=CODIGO`, Jornada com 7 níveis, 3 renovações = 15% OFF,
  3 indicações = HBO Max, 12 meses = prêmio surpresa.
- Admin/Segurança: editar vagas, tarja de vencimento < 5 dias, "Repor conta" sem apagar
  histórico (`alocacoes.status`), aba Suporte, e o cliente nunca vê total de vagas nem
  contagem de usuários da matriz.

### Verificações
- `bun run typecheck` OK · `bun run build` OK
- `ALTER TABLE aplicativos ADD COLUMN preco` aplicado à mão (db:push exige TTY para
  coluna NOT NULL sem default) · `db:push` aplicado para `combos` e `codigos_otp`
- Webhook testado: 200 com código extraído, 422 quando o e-mail não tem código
- E2E `errors: []` e `http_errors: []` em landing, admin (Aplicativos, Central de Códigos)
  e cliente (Meus Acessos, Novidades) + suítes antigas (gamificação, faturas, visão geral)

---

## Fase — UX do painel do cliente: acesso direto, guia, PWA e assistente de IA

### 1. Link de acesso direto por app
- `web/lib/servicos-info.ts` — fonte única com site oficial, tipo de login (`web` / `app` /
  `perfil`), dispositivos, passo a passo e dicas para os 35 slugs do catálogo, com fallback
  seguro para qualquer slug novo cadastrado pelo admin.
- Cada card em Meus Acessos ganhou o botão "Abrir <serviço>" (`target="_blank"`,
  `rel="noopener noreferrer"`). Fica desabilitado enquanto o acesso está "liberando".

### 2. Pop-up "Como acessar"
- `components/cliente/como-acessar.tsx` — modal em portal, fecha por overlay/ESC/botão,
  scroll interno e bottom sheet no celular.
- Conteúdo: passo a passo numerado do primeiro login, dispositivos suportados, dicas do
  serviço e bloco "Regras de ouro" (não trocar senha/e-mail/telefone, não convidar
  ninguém, não cancelar, usar só o próprio perfil, onde pegar o código OTP, como pedir
  reposição).
- Abre pelo botão "Como acessar" ou clicando no nome do app.

### 3. PWA "Instalar Aplicativo"
- `public/manifest.webmanifest` (standalone, `start_url: /dashboard`, tema `#09090b`,
  atalhos), ícones gerados 192/512 + maskable + apple-touch, `public/sw.js`
  (network-first, ignora `/api/*` e arquivos do dev server) e as metas de PWA/iOS no
  `index.html`.
- `web/lib/pwa.ts` guarda o `beforeinstallprompt` num singleton (o evento dispara antes do
  React montar) e expõe `estaInstalado()` / `ehIOS()`.
- `components/cliente/instalar-app.tsx` — card com botão "Instalar App"; no iOS (sem o
  evento) mostra o roteiro Compartilhar → Adicionar à Tela de Início. Some quando já
  instalado ou dispensado (`localStorage`).

### 4. Assistente de IA de suporte
- `api/agent/gateway.ts` + `api/agent/index.ts` — `ToolLoopAgent` com
  `anthropic/claude-haiku-4.5`, persona restrita ao painel: recusa qualquer assunto fora
  de acessos, códigos, faturas, jornada e combos.
- `api/agent/tools/painel.ts` — tools criadas por `ferramentasDoCliente(clienteId)`:
  `meusAcessos`, `comoAcessar`, `codigoRecente`, `minhasFaturas`, `minhaJornada`,
  `meusChamados`, `combosDisponiveis`. O id vem SEMPRE da sessão, nunca do modelo, então
  o agente não alcança dados de outro cliente.
- Segurança: nenhuma tool devolve senha de conta matriz — o agente manda copiar pelo card.
- `POST /api/agent/messages` (rota HTTP pura, streaming) resolve o cliente com
  `auth.api.getSession` e responde 401 sem sessão.
- `components/cliente/assistente.tsx` — botão flutuante + chat (`useChat` +
  `DefaultChatTransport`), sugestões rápidas, estado "consultando seu painel...",
  renderizador de **negrito**/`código` e bottom sheet no celular.

### Verificações
- `bun run typecheck` OK · `bun run build` OK
- E2E `/tmp/e2e_ux.py` (1500x1150) e `/tmp/e2e_ux2.py` (390x844): `errors: []` e nenhuma
  resposta HTTP >= 400; 7 cards com link direto (`https://www.netflix.com/br/login`,
  `_blank`, `noopener noreferrer`); manifest 200; `sw.js` 200; `<link rel=manifest>`
  presente; modal com passos + regras abrindo e fechando por ESC.
- Assistente respondeu com dados reais do banco (7 apps do Mega Promo, fatura de 12/08/2026
  R$ 50,92 com PPN15OFF) e recusou pergunta fora de escopo ("receita de bolo").
- Rodapés do modal e do chat com espaço extra no mobile para não colidir com o badge Runable.

## Operação: status em 4 estados, fidelidade e alertas (concluído)
- Status do cliente: ativo ("Finalizado") | pendente | atrasado | suspenso (>7 dias). Varredura automática a cada 60s ao abrir painéis.
- Clientes (admin): abas por status com contadores, forma de pagamento editável na linha, botão "Alterar vencimento" com motivo obrigatório + histórico.
- Trava de vencimento: usuarios.atualizar não altera proximaCobranca; só usuarios.alterarVencimento (grava histórico e notifica o cliente).
- Central de Alertas (admin): OTP, TV, suporte, vencimento 3 dias/no dia, atraso diário. Webhook opcional via ALERTAS_WEBHOOK_URL.
- Cliente: checklist obrigatório no 1º acesso, contador regressivo, sino de avisos, tela de bloqueio (Pix + WhatsApp) quando atrasado/suspenso.
- Manual do Admin v1.1 com a seção "Central de Alertas e Regras de Fidelidade".

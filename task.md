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

---

## Fase — Restauração do ambiente a partir do zip (09/08/2026)

- Projeto recriado em `/home/user/playplusnow` via `app_init` (template 0.3.0, mesma
  versão do zip) e código-fonte copiado por cima — infra gerenciada nova (.env, Turso, S3,
  AI gateway) que o zip não trazia.
- `bun install` (4 deps extras do web resolvidas: ai, @ai-sdk/react, better-auth, dedent).
- `db:push` aplicado no banco novo → 14 tabelas do app + 4 do Better Auth.
- `seed.ts` refatorado: nova função exportada `executarSeed()`, usada pela procedure
  `seed.run` (admin) e pelo novo script `packages/web/scripts/seed.ts` (`bun run seed`),
  que permite popular um banco novo sem sessão de admin.
- Novo `packages/web/scripts/admin.ts` (`bun run admin <email> [remover]`) para promover
  administrador.
- Seed executado: 3 pacotes, 15 contas matrizes, 8 clientes.
- Contas de teste: admin@playplusnow.com / Admin@2026 (admin) e
  diego.silva@email.com / Cliente@2026 (cliente, casou com a linha do seed).
- Verificado: typecheck 3/3, build OK, `/`, `/dashboard` e `/admin` logados sem erros de
  console, overflowX 0 em 1440. Dev server em tmux `dev`, porta 4200.
- Documentado em `SETUP.md` (como rodar, como trocar o Turso, pendências de lint).

## Fase — Atualização estrutural SaaS (10/08/2026)

Diretrizes do Diego (7 blocos). Decisões preenchidas por mim:
- Pix: adaptador com modo simulado (provedor plugável depois).
- Sala de Jogos: R$ 9,90/mês.
- Saque: mínimo R$ 10, taxa R$ 3,50 (configurável em `configuracoes`).
- Crédito em desconto: +25% de bônus; +1% de performance se a rede tiver >=90% em dia.

Ordem: schema -> seed/landing -> rotas -> queries -> admin -> painel cliente -> IA -> testes.

### Progresso 10/08 (sessão 2)
- Rotas criadas e registradas no router: afiliados, giftcards, jogos, saude, winback, pix (+ webhook /api/webhooks/pix).
- Landing atualizada: preços oficiais em mock-data (total R$ 252,40), 5 depoimentos reais, contador 1.540 assinaturas, "Garantia de 7 dias" removida (hero, social-proof, mock-data, seed).
- Catálogo `aplicativos` semeado (15 apps, precoAvulso oficial) via semearAplicativos() — roda sempre no executarSeed.
- ATENÇÃO: o db:push --force da sessão anterior apagou `usuarios` e `contas_matrizes`. Reseed feito (3 pacotes/15 contas/8 usuários) e novo script `bun run religar` recriou o vínculo auth->usuarios (admin@playplusnow.com volta a ser admin).
- Queries criadas: afiliados, giftcards, jogos, saude, winback, pix.
- Falta: views do admin (Gestão de Contas, Sala de Jogos, Saúde, Recuperação, Pix), painel do cliente (Sala de Jogos, Carteira/Afiliado, contador de economia, Pix), base de conhecimento da IA, build+smoke+deliver.
- Views admin criadas e ligadas: gestao-contas-view, saude-view, jogos-view, recuperacao-view, comissoes-view (dentro da aba Afiliados), pix-view (dentro de Faturas).
- Painel cliente: abas "Sala de Jogos" e "Indique e Ganhe", ContadorEconomia em Meus Acessos, PagarPix em Faturas.
- IA: src/api/agent/conhecimento.ts (REGRAS_DE_USO + ESCALONAMENTO) injetado no assistente do cliente e no copiloto admin.
- Verificado: typecheck 3/3, build 2/2, smoke Playwright sem erros de console, overflowX 0 em 1440 e 390.

### Encerramento (10/08/2026)
- setup.tsx: pendência de lint reduzida a 1 item (mobile `_layout.tsx`); pendência "aplicativos vazia" removida (resolvida pelo seed); depoimentos saíram da lista de mockados; PIX_WEBHOOK_TOKEN adicionado às integrações pendentes.
- `bun run lint` → 1 erro (mobile `_layout.tsx`, template-managed, não corrigível).
- `bun run typecheck` → 3/3. `bun run build` → 2/2.
- smoke.py e smoke2.py → overflowX=0 e errors=[] em todas as páginas/abas, 1440px e 390px.
- SETUP.md atualizado com a seção "Atualização estrutural (10/08/2026)": 7 blocos, 8 tabelas novas, 6 rotas novas + webhook Pix, parâmetros configuráveis, gateway Pix simulado, verificações e pendências.
- Entregue via `deliver` (website, porta 4200).

### Em aberto para o usuário
- Manter o Turso provisionado aqui ou apontar para o banco dele.
- Credenciais: EMAIL_WEBHOOK_TOKEN, PIX_WEBHOOK_TOKEN (provedor Pix real), WhatsApp/CallMeBot.

### Checkout na plataforma (10/08/2026 — sessão 3)
Objetivo: tirar o WhatsApp de TODO botão de compra. Compra e renovação acontecem
no site, com Pix de baixa automática e ativação sem intervenção humana.

- API: `routes/checkout.ts` (resumo/pagar/status/meusPedidos) + `lib/pedidos.ts`
  (precificarPedido, aplicarPedido, faturaDoPedido, cobrancaViva). O front nunca
  manda preço — só a escolha; o servidor precifica pela tabela do banco.
- `cobrancas_pix` ganhou `descricao` e `pedido` (JSON). `confirmarPagamento`
  aplica o pedido, quita a fatura, reativa o cliente, empurra o vencimento para
  o próximo ciclo (pagamento de fatura simples) e apura comissão do indicador.
- Página `/checkout`: resumo, Pix copia-e-cola, polling e redirect para o painel.
- CTAs migrados: planos, montador, combos (landing e painel), cadastro, login
  (`?next=checkout`), faturas do painel (`Pagar com Pix` por fatura), upgrades,
  tela de bloqueio (PagarPix embutido) e contador de vencimento
  (`irParaPagamento` em `lib/navegacao.ts`). Sala de Jogos ganhou atalho
  `/checkout?jogos=1`. WhatsApp ficou só em suporte.
- Correções: título "Pacote Pacote 03" → "Pacote 03"; competência já quitada não
  reabre fatura paga (cobrança avulsa); PagarPix invalida faturas/usuarios/
  recompensas quando o Pix é confirmado.
- Verificado: typecheck 3/3, build 2/2, lint só o erro template do mobile.
  E2E real: checkout combo+jogos R$ 74,34 → webhook → cliente ativo, apps
  alocados, salaJogos on; fatura em aberto → Pagar com Pix → confirmado;
  tela de bloqueio → Pix → cliente volta a ativo e vencimento avança.
  smoke.py (agora com /checkout) e smoke2.py: overflowX=0, errors=[].

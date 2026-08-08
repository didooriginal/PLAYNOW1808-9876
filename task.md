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

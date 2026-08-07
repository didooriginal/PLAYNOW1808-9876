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

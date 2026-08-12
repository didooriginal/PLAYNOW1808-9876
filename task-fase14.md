# Fase 14 — port do export do Lovable para o projeto local

Decisões do usuário: gate de afiliado = **nível 3**; corrigir markdown literal (`**Nível 2**`) para
negrito real e texto "Nível 3"; **não** portar `seed_full.ts` (30 clientes fictícios).

Descartado de propósito: infra do Lovable (Supabase/Postgres/TanStack Start), `styles.css` do shadcn,
`src/components/ui/*` cru, hacks `0 as any` / `as any` de rota, `ciclo: "monthly"|"yearly"`,
comentário-instrução no topo do `landing.tsx`.

- [x] 1. Schema: `usuarios.nivel`, `usuarios.afiliadoAtivo`, tabela `banners_afiliados` + db:push
- [x] 2. API afiliados: `nivel`/`afiliadoAtivo` no `meuPainel`, `tornarAfiliado` (nível 3), `listarBanners`
- [x] 3. Queries: `useTornarAfiliado`, `useBannersAfiliados`
- [x] 4. Carteira: fluxo de convite (nível 3 sem afiliado) + visão restrita (< nível 3)
- [x] 5. Landing: `new-sections.tsx` (Stats, Features, Faq) montado em `pages/index.tsx`
- [x] 6. Textos/CTAs: hero, site-header, combos, builder, footer, social-proof, savings, mock-data,
      servicos-info, boas-vindas, manual-admin
- [x] 7. Segurança: `alterar-senha.tsx` + aba `senha` no dashboard + `navegacao.ts` + rótulos por nível
- [x] 8. Signup (confirmar senha + WhatsApp obrigatório), `routes/usuarios.ts`, checkout (voltar do Pix)
- [x] 9. Seed: campo `nivel` nos 8 clientes + banners (sem `seed_full`)
- [x] 10. Validar typecheck 3/3, build 2/2, rotas 200, screenshots, console limpo
- [x] 11. Commit + push + deliver + checklist comparativo para o usuário

## Notas da execução

- O `db:push` que adicionou `nivel`/`afiliado_ativo` recriou a tabela `usuarios` no Turso e zerou os
  registros (as contas do Better Auth na tabela `user` continuaram intactas). Base restaurada com
  reinserção dos 8 clientes de demonstração + `religar-contas` + `admin admin@playplusnow.com`.
- `semearBannersAfiliados()` é idempotente e roda mesmo em banco já populado (não depende de `force`).
- `CLIENTES` do seed passou a ser exportado para permitir restaurações pontuais.
- Conta de teste `diego.silva@email.com` ficou em **nível 3 com painel de afiliado ativo** (usada para
  validar os 3 estados da carteira). Para voltar à visão restrita, baixar `nivel` para 1.
- Validado: typecheck 3/3, build 2/2, `/ /login /dashboard /admin` → 200, screenshots 1440px e 390px
  com console sem erros (`ERROS: []`).
- Pendente do lint: `bun run lint` na raiz falha por erro pré-existente do template no
  `packages/mobile/app/_layout.tsx`; oxlint do `packages/web` crasha (bug do binário).

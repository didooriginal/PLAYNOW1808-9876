# Fase 15 — Port do novo export + hardening pré-lançamento

## Checklist
- [ ] 1. Segurança crítica: `/setup` público expõe senhas de teste → gate DEV/admin + remover senhas literais
- [ ] 2. `auth.ts`: `trustedOrigins` sem `["*"]` + `rateLimit`
- [ ] 3. `robots.txt`: `Disallow: /api/rpc`, `/api/auth`
- [ ] 4. IDOR: `notificacoes.marcarLida` filtra por `clienteId` do usuário logado
- [ ] 5. Price manipulation: `usuarios.escolherPacote` recalcula `valor` no servidor
- [ ] 6. `alocacoes`: `eq(usuarios.admin, false)`
- [ ] 7. Schema: `usuarios.aparelhos` + tabela `marketing_texts` + `db:push`
- [ ] 8. E-mails: `api/lib/emails/templates.ts` + `cron.ts` (aviso vencimento 3 dias)
- [ ] 9. Endpoint cron protegido por `CRON_SECRET` em `src/api/index.ts`
- [ ] 10. Módulo Marketing: route + query + `marketing-view.tsx` + aba admin + `ajuda-admin.ts`
- [ ] 11. `alocacoes.alocarPorServico` + UI; admin.tsx: coluna Nível, aparelhos, selo admin, `confirm()` exclusão, "Adicionar App", checkbox Administrador
- [ ] 12. Signup: campo obrigatório aparelhos + pattern e-mail
- [ ] 13. Páginas `/termos`, `/privacidade`, `/tutoriais` (Wouter) + links footer
- [ ] 14. `mock-data.ts`: preços avulsos + `redeemUrl`; textos de regras; link RESGATAR
- [ ] 15. Misc: whatsappLink sobrecarga, botão flutuante WhatsApp, Logo→/, checkout resetarPix
- [ ] 16. Validação: typecheck 3/3, build 2/2, rotas 200, screenshots 1440/390, commit+push, deliver

## Descartado de propósito
- `src/api/__core/app.ts` (arquivo template-managed, proibido editar) → mitigação em `auth.ts`
- infra Lovable: routes/TanStack, supabase, drizzle pg, seed destrutivo
- `marketing.gerarComIA` (stub falso do export)

## Progresso (aplicado)
- [x] 1 setup gate (AdminRoute) + SenhaOculta
- [x] 2 auth.ts trustedOrigins + rateLimit
- [x] 3 robots.txt
- [x] 4 marcarLida IDOR
- [x] 5 escolherPacote preço server-side + aparelhos
- [x] 6 alocacoes.alocarPorServico
- [x] 7 schema aparelhos + marketing_texts (db:push OK)
- [x] 8 emails/templates.ts + emails/cron.ts
- [x] 9 GET /api/cron/vencimento (503 sem CRON_SECRET)
- [x] 10 marketing (route+query+view+aba+ajuda) + copiloto escuta ppn:abrir-copiloto
- [x] 14a mock-data: whatsappLink overload, redeemUrl, preços novos
- [x] footer links reais, logo clicável, panel-shell botão WhatsApp
- [x] 13 páginas /termos /privacidade /tutoriais em Wouter
- [x] 11 alocarPorServico + UI; admin.tsx (Nível, Contatos & aparelhos, selo admin, confirm() exclusão/toggle, Adicionar App, checkbox Administrador)
- [x] 12 signup: campo aparelhos obrigatório + pattern e-mail
- [x] 14b RESGATAR NO SITE em gestao-contas-view + textos de regras (boas-vindas, servicos-info)
- [x] 15 checkout resetarPix chama pagar.reset()
- [x] Correção pós-validação: `<a>` aninhado — Logo voltou a ser `<div>`, footer ganhou `<Link>` em volta
- [x] CRON_SECRET gerado no .env da raiz (endpoint saiu de 503 → 401 sem token)
- [x] 16 typecheck 3/3, build 2/2, 8 rotas 200, screenshots 1440/390 com ERROS: [] (só 404 de dados: "Cliente não encontrado")

## Observações
- Banco (Turso, compartilhado com produção) hoje tem 8 usuários: 7 clientes de seed sem login + admin@playplusnow.com. `diego.silva@email.com` não existe mais como cliente — o dashboard do cliente cai no estado vazio "Nenhum cliente cadastrado" (sem crash).
- Auth user órfão (sem linha em `usuarios`) faz `netflix.minhaTela` devolver 404 em loop de 10s. Não é regressão desta fase, mas vale tratar depois.
- /tutoriais usa vídeos placeholder (Rick Astley) — precisa dos links reais.

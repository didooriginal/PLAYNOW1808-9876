# PLAYPLUSNOW — crédito de confiança + gestão de pacotes

## Concluído
1. Schema aplicado no Turso (`confianca_ate`, `confianca_motivo`, `confianca_concedida_em`, `confianca_total`).
   ATENÇÃO: o `db:push` recriou a tabela `usuarios` e apagou os clientes → rodei `seed -- force` + `religar` + `admin`.
2. Chaves de ajuda novas em `lib/ajuda-admin.ts` (cliente.confianca*, pacote.ativar/editar/badge/accent/apps).
3. Admin → Clientes: botão de crédito (escudo, destacado para atrasado/suspenso), modal com presets 24/48/72h/7d + motivo,
   selo "Xh Ym" na coluna Status e botão de revogar.
4. Admin → Pacotes: toggle Ativo/Inativo (card apagado + pill "inativo") e modal de edição completo
   (nome, preços, tagline, benefícios, badge, accent, vagas, destaque, apps).
5. Painel do cliente: `FaixaConfianca` (contador ao vivo + CTA de pagamento) acima de tudo, em todas as abas.
6. Landing já filtrava `ativo` (`queries/planos.ts`) — nada a mudar.
7. BUG corrigido: `pacotes.atualizar` usava `pacoteInput.partial()`, e os `.default()` do zod zeravam
   servicos/perks/vagas/accent num patch parcial. Agora tem schema próprio sem defaults + descarte de undefined.
   O pacote "15 em 1" foi reparado por SQL depois de ser zerado no primeiro teste.

## Validado
- `bun run typecheck` 3/3, `bun run build` 2/2, rotas `/ /login /dashboard /admin` → 200.
- Screenshots: /tmp/shots/cf-selo.png, cf-modal.png, cf-pacotes.png, cf-editar.png, cf-painel.png.
- Nenhum aviso `[ajuda]` de chave faltando.

## Pendências para o usuário
- Pacote "15 em 1" lista 17 serviços (seed).
- Preços provisórios: Looke 19,9/12,9 · Telecine 29,9/17,9 · Record+ 14,9/9,9 · Hulu 44,9/24,9.
- Hulu não opera no BR.
- Trocar senhas de teste Admin@2026 / Cliente@2026.
- `landing/social-proof.tsx:52` fala "sete boletos" (Turbo tem 10 apps).

---

## Fase 8 — Pagamentos reais (Mercado Pago) — CONCLUÍDA
- `api/lib/mercadopago.ts`, `api/lib/webhook-mercadopago.ts` (valida HMAC `x-signature` e SEMPRE reconsulta o recurso na API do MP), `api/lib/aviso-pagamento.ts`.
- `api/routes/assinaturas.ts` (Preapproval cartão) + `POST /api/webhooks/mercadopago` + tabela `assinaturas` (db:push aplicado).
- Checkout com escolha Pix x Cartão; `sincronizarCobranca` reconfere ativamente (em localhost o webhook não é alcançável).
- Baixa manual do admin (`pix.confirmar`) mantida de propósito como plano B (dinheiro/transferência).
- Modo simulado removido.

### Pendências externas (usuário)
- [ ] `RESEND_API_KEY` (sem ela o aviso de pagamento fica só como alerta no painel admin).
- [ ] Verificar domínio `playplusnow.com.br` no Resend → Domains.
- [ ] Cadastrar webhook em MP → Suas integrações → Webhooks: `https://playplusnow.com.br/api/webhooks/mercadopago` (eventos "Pagamentos" e "Planos e assinaturas").
- [ ] Ao publicar: fazer um Pix real de valor baixo ponta a ponta.
- [ ] Trocar senhas de teste `Admin@2026` / `Cliente@2026`.
- [ ] Confirmar preços reais de Looke e Record+.

## Fase 9 — Landing: robô de pré-venda + WhatsApp flutuantes — CONCLUÍDA
- `api/agent/vitrine.ts` + `api/agent/tools/vitrine.ts` + `POST /api/agent/vitrine` (público, sem sessão; tools só de catálogo; 30 req/IP/10min, 20 msgs/conversa, 1.200 chars/pergunta).
- `components/landing/assistente-visitante.tsx` e `components/landing/whatsapp-flutuante.tsx`, montados em `pages/index.tsx`.
- Arrastáveis via `useArrastavel` (arrasto após 4px, preso na viewport, posição em `localStorage`, duplo clique reseta).
- No mobile os dois viram só ícone (54x54) para não tampar o card do combo — validado em 390x844 e 1280x800.

## Fase 10 — Catálogo: Hulu e Telecine removidos — CONCLUÍDA
- Hulu é hub dentro do Disney+; Telecine Play encerrou em 2021 e virou área do Globoplay.
- Turbo recomposto com `globoplay` + `spotify` (segue com 10 apps); "15 em 1" mantém 15 apps.
- Agentes ensinados a responder a equivalência (`api/agent/conhecimento.ts`) em vez de "não temos".

## Fase 11 — E-mail transacional em produção (Resend) — CONCLUÍDA
- `RESEND_API_KEY` e `EMAIL_REMETENTE` gravados no `.env` da raiz (é o único env que o deploy leva).
- `ADMIN_EMAIL` = `playnowplus01@gmail.com`.
- `services/email.ts`: `REMETENTE_PADRAO` agora é `PLAYPLUSNOW <nao-responda@playplusnow.com.br>` (domínio verificado), então nem depende da env.
- Testes reais executados: envio simples OK; fluxo de recuperação de senha → `entrega: "enviado"`; `avisarAdminPagamento` → `{painel:true, email:true}`.
- Sem 403: entregou para destinatário fora da conta Resend.
- PENDENTE: não existe fluxo que envie as CREDENCIAIS DE STREAMING por e-mail — hoje o cliente vê no painel e o admin manda pelo WhatsApp.

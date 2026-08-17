# Etapa C — blocos 2, 6, 1, 8

- [x] Bloco 2 — CampoSenha (olho + copiar) em login, signup, redefinir-senha, alterar-senha, admin NovaContaForm, EditorConta, jogos-view.
- [x] Bloco 6 — cliente criado pelo ADM: senha provisoria mostrada 1x, troca obrigatoria no 1o acesso, aba "Meus Dados" (telefone/endereco/avatar).
- [x] Bloco 1 — niveis 1-7 por XP; carteira de afiliado so a partir do nivel 3; abaixo disso "Indique e Ganhe" com barra de XP.
- [x] Bloco 8 — usuarios.definirPacote + modal no admin com previa de preco e resumo (alocados / fila).
- [x] db:backup + db:push (sem mudancas pendentes), typecheck 3/3, build 2/2, 9 rotas 200, screenshots 1440/390 com ERROS: [].
- [x] Teste em runtime: definir pacote no cliente 93 -> alocou NETFLIX/PRIME, fila SPOTIFY + NETFLIX-COMPARTILHADA.
- [ ] Etapa D (Bloco 13, placeholder IPTV) — aguardando revisao do usuario.

## Incidente
As fichas 91/92/93 da tabela `usuarios` sumiram durante os testes (backup 05:02 tinha 3, banco tinha 1 recriada pelo
`garantirFichaDaSessao` com admin=0). Restauradas a partir de backups/backup-2026-08-17T05-02-55.json e a duplicata 94 removida.
Nenhuma outra tabela foi afetada. Evitar cliques automatizados em botoes de exclusao nos scripts de screenshot.

## Central de Códigos 2.0 (17/08/2026) — CONCLUÍDA

- [x] 13.1 `email_captura` na matriz + campo no admin (editar conta e nova conta) com botão "sugerir" e ajuda `contas.emailCaptura`
- [x] 13.2 tabela `pedidos_codigo`, `lib/codigos-entrega.ts` (FIFO, janela 10 min, validade 15 min), webhook casa por e-mail de login OU captura
- [x] 13.3 front do cliente: `codigo-acesso.tsx` (pedir, polling 5s, contagem MM:SS, "já usei"), ligado na Netflix e no modal "Como acessar" de todos os apps; botão "Conectar minha TV" (netflix.com/tv2, nova aba); aviso "não clique em Atualizar residência"
- [x] 13.4 admin: selo "entregue a X" / "sem dono — ninguém pediu", filtro e lista "Pedidos abertos agora"
- [x] 13.5 `docs/email-worker.js` + seção no `SETUP.md`
- [x] db:backup + db:push aplicados; typecheck 3/3; build 2/2; 9 rotas 200; screenshots 1440/390 com ERROS: []
- [x] teste de isolamento/expiração/sem-dono: `packages/web/scripts/teste-entrega-codigo.ts` → TUDO OK (10/10)
- [x] commit + push origin main

Pendências do usuário: ativar Cloudflare Email Routing + subir o Worker, encaminhar os
e-mails das matrizes para o endereço de captura e preencher esse campo em cada matriz.

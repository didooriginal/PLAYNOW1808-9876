# Rodada atual

1. [x] /signup tela branca (import CampoSenha) — corrigido, verificado, commitado
2. [x] Vagas mudando sozinhas (roda do mouse) — corrigido, verificado, commitado
3. [ ] Caixa de entrada no admin: tabela `emails_recebidos` + gravar SEMPRE + aba em codigos-view
4. [ ] Gatilhos Resend: boas-vindas no cadastro (auth.ts hook + templates.boasVindas) — código escrito, falta verificar
   - redefinição de senha JÁ existia (auth.ts sendResetPassword -> lib/senha.ts registrarReset)

Verificação: typecheck 3/3, build 2/2, 9 rotas 200, screenshot ERROS: [], commit+push, deliver.
Backup antes de db:push: `bun run db:backup`.

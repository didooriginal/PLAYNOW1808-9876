# Tarefas — rodada atual

Decisões do usuário: IPTV 1 tela R$ 35 · 2 telas R$ 50 · netflix-individual R$ 25 ·
convite só de contas Netflix marcadas como liberadas para individual.
Ordem escolhida: PERFORMANCE iOS primeiro, resto depois.

## 1. Performance iOS  (CONCLUIDA)
Feito:
- react-icons removido de app-icon.tsx (era codigo morto)
- lazy(): paginas de auth (login/signup/esqueci/redefinir), AgentFeedback do
  website-runtime (arrastava html-to-image), secoes abaixo da dobra
  (abaixo-da-dobra.tsx: builder/savings/plans/new-sections/social-proof/combos/footer)
- fontes: Google Fonts bloqueante removido -> woff2 variavel self-hosted em
  public/fonts/ com preload no index.html
- PNGs dos apps otimizados (57-67% menores pelo asset-optimizer)
- casca estatica do hero dentro de #root no index.html: pinta a primeira tela
  antes do JS. createRoot limpa ao montar (verificado: cascas_residuais = 0,
  um unico h1, ERROS: [])
Numeros (Chrome CDP, iPhone 390x844, 4G 9Mbps/100ms, CPU 4x):
- bundle inicial: 744 kB min / 206 kB gzip  ->  558 kB / 167 kB
- FCP no dist local: 1728 ms -> 428 ms
- baseline producao antes: FCP 2096 ms, h1 2449 ms, 928 kB, 28 pedidos
- remedir contra producao DEPOIS de publicar (meta: primeira tela < 2s)
Decisao: manter build.sourcemap condicional a ANALISAR=1 no vite.config.ts
(sem efeito no build normal, util para futuras analises)

## 2. Netflix individual (PENDENTE)
- procedure adminOnly p/ lançar convite manualmente
- flag na conta matriz: liberada para individual (decisão do usuário)
- seção ADM: quem está em qual conta, 2 convites por conta, vaga livre/ocupada
- marcar enviado passa a exigir contaId (hoje conta_id fica null)

## 3. IPTV (PENDENTE)
- card do cliente: link iOS (XCloud Mobile), Android (Play Store), TV (FUNPLAY na loja)
  iOS: https://apps.apple.com/br/app/xcloud-mobile/id6471106231
  Android: https://play.google.com/store/apps/details?id=com.funplusplay.app&hl=pt_BR
- corrigir também o e-mail de boas-vindas do IPTV (usa LINK_APP_IPTV antigo)
- opções 1 tela (R$ 35) / 2 telas (R$ 50) no planos_apps

## 4. Busca de clientes no ADM (PENDENTE)
- campo texto: nome, e-mail, whatsapp — em ListaClientes (admin.tsx ~2195)

## 5. E-mail de cancelamento (PENDENTE)
- FURO: webhook-mercadopago.ts tratarAssinatura() só atualiza status, não manda
  e-mail nem alerta. O painel (routes/assinaturas.ts) manda. Ligar no webhook
  sem duplicar quando já saiu pelo painel.

## Lembrar
- vite.config.ts tem `build.sourcemap` condicional a ANALISAR=1 (backup /tmp/vite.config.bak)
  -> decidir se mantém (útil) antes do commit
- Pronto = typecheck 3/3, build 2/2, screenshot ERROS: [], commit+push, deliver pt-BR

## 6. Contas matrizes — radar do usuario (NOVO)
- BUG DIAGNOSTICADO (causa raiz): existem DUAS fontes de verdade de ocupacao.
  1) coluna contasMatrizes.vagasOcupadas -> e a que o alocador consulta
     (jogos.ts:64, saude.ts, acessos.ts) e a que o admin edita na mao.
  2) contagem viva de alocacoes ativas -> conta-card.tsx:620
     `const ocupadas = vinculos.length` e o que aparece no card.
  O form de edicao (conta-card.tsx:581) NAO manda vagas. O que acontece:
  useInvalidarContas (queries/contas.ts:15) invalida contas+usuarios+alocacoes,
  a lista de vinculos e refeita e o numero na tela salta para a contagem real.
  Parece que salvar mexeu na vaga; na verdade trocou qual dos dois numeros
  aparece. Alem disso sincronizarVagas (acessos.ts:27) sobrescreve
  vagasOcupadas com a contagem de alocacoes -> apaga o ajuste manual do admin.
  CORRECAO planejada:
  - card passa a exibir a coluna vagasOcupadas (a autoritativa), e lista os
    vinculos como "clientes vinculados" separado; quando divergirem, mostrar
    aviso + botao sincronizar (procedure contas.sincronizar ja existe)
  - travarVagas = true faz sincronizarVagas RETORNAR sem escrever, e
    editarVagas/atualizar recusarem alteracao de vagas com mensagem clara
- Ideia do usuario: "trava fisica" por conta = liga/desliga a alteracao de vagas.
  Conta travada: vagas nao mudam por nada (nem recalculo, nem edicao).
- Pagina de gestao de contas esta "muita conta solta" (49 contas). Precisa
  reorganizar; usuario ainda nao sabe como -> eu proponho opcoes com base no
  que existe (agrupar por servico, por ocupacao, vagas livres primeiro, busca).
- Fazer junto da tarefa 2 (mesma tabela contas_matrizes, mesma migracao).

## Ordem de execucao acordada
4 (busca clientes) -> 3 (IPTV) -> 5 (email cancelamento) -> 2 + 6 (Netflix
individual + trava de vagas + reorganizacao das contas)

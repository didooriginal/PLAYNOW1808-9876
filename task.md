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

# Fase 16 — Bloco 1 (crítico)

- [x] 1.1 `api/lib/sessao.ts` (`fichaDaSessao` / `garantirFichaDaSessao` / `ehAdmin`); `usuarios.eu` + `adminOnly` usam o mesmo lookup. Verificado: `eu` → admin:true clienteId:87; `usuarios.resumo` (adminOnly) 200. typecheck 3/3.
- [x] 1.2 `assinaturas_apps` + `fila_vagas` no schema; `api/lib/acessos.ts` (`sincronizarAcessosDoCliente`); `garantirAlocacao` filtrando aceitaNovos/reserva/poolJogos e devolvendo motivo; `aplicarPedido` + `escolherPacote` chamando a sincronização.
- [x] 1.3 Popup "Apps deste cliente" (`components/admin/modal-apps-cliente.tsx`, query em `src/web/queries/alocacoes.ts`, textos em `ajuda-admin.ts`), `adicionarAppAoCliente`.
- [x] 1.4 Campo `ativa` em `contas_matrizes` + `contas.alternarAtiva` + toggle no `conta-card.tsx`.
- [x] 1.5 `realocarClientes(contaId, motivo)` usado por `repor` / on-off / `remover` + `fila_vagas` + alerta `wa.me`.
- [x] 1.6 Login: senha 2x, `session.expiresIn` 30d + `rememberMe`, "Trocar de conta" no `panel-shell.tsx`, `VITE_WEBSITE_URL` NÃO foi adicionado de propósito: o authClient já cai em `window.location.origin`, e um valor fixo no build quebraria produção/preview.
- [x] Fecho: typecheck 3/3, build 2/2, rotas 200, screenshots `ERROS: []`, commit+push, deliver.

## Notas
- Banco compartilhado com produção: nada de seed destrutivo. `db:push` sem TTY via `script -qec`.
- `bun run lint` tem erro pré-existente do template (mobile `_layout.tsx`) e o oxlint de packages/web crasha (SIGABRT) — não é regressão.
- Script de diagnóstico: `packages/web/scripts/diag-eu.ts`.

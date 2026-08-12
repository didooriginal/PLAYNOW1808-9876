# Fase 13 — checklist

Números aprovados: ciclos **trimestral 5% · semestral 10% · anual 20%**;
antecipação **fatura em aberto 5% · próximo mês 10%** (só Pix).
Fonte única de preço/data: `packages/web/src/api/lib/ciclos.ts` (o front só manda
QUAL opção, o servidor precifica).

## Itens

- [x] **1. Ciclos no checkout dos apps avulsos** — `api/routes/ciclos.ts`,
      `queries/ciclos.ts` (`useTabelaCiclos`), `components/seletor-ciclo.tsx`,
      `landing/builder.tsx`, `pages/checkout.tsx`. Rótulos e percentuais vêm de
      `orpc.ciclos.tabela` (nada hardcoded).
- [x] **2. Reordenar a grade de aplicativos da landing** — `OrdemDaGrade` +
      `BotaoMover` em `components/admin/apps-view.tsx`, procedure
      `aplicativos.reordenar({ ids })`. Setas ↑/↓ e ⇈/⇊ (drag-and-drop foi
      descartado: erra a mira no mobile). Grava só no clique em
      **Confirmar ordem**. E2E: ordem persiste após reload.
- [x] **3. Área de pagamento do cliente (trimestral/semestral/anual)** —
      `components/cliente/pagamento.tsx` (`AreaPagamento`), aba `pagamento` do
      dashboard ("Pagar / Renovar"). Verificado: Mensal 49,00 · Trimestral
      139,65 · Semestral 264,60 · Anual 470,40.
- [x] **4. Antecipar pagamento com desconto no Pix** — mesmo arquivo, dois
      cartões: fatura em aberto **5%** (09/2026 → R$ 46,55, vence 12/09/2026) e
      próximo mês **10%** (10/2026 → R$ 44,10, 12/10/2026). "Vigente" = fatura
      não paga de menor vencimento; "próximo" = mês seguinte a ela, para os dois
      cartões nunca venderem a mesma competência.
- [x] **5. Confirmar + selo "Salvo" mantendo o auto-save** —
      `components/admin/salvamento.tsx` (`SeloSalvo`, `BarraSalvamento`,
      `useAutoSalvar`, `useSeloTransitorio`), aplicado em `apps-view.tsx`
      (ordem + preço inline), `ModalEditarPacote` em `pages/admin.tsx`,
      `combo-builder.tsx` e `conta-card.tsx`.
- [x] **6. Backup do banco em .xlsx, uma aba por tabela** — rota
      `GET /api/admin/backup.xlsx` (sessão + `usuarios.admin`) e
      `components/admin/backup-card.tsx` em `gestao-contas-view.tsx`.
      E2E: 17 abas; abas vazias mostram `(sem registros)`; senhas de matriz só
      com `?senhas=1`; hashes de auth/sessão nunca entram.

## Verificação

- `bun run typecheck` → 3 successful, 3 total.
- `bun run build` → 2 successful, 2 total.
- Screenshots 1440px e 390px sem overflow; console sem erros e sem aviso `[ajuda]`
  (toda UI nova de admin tem chave em `lib/ajuda-admin.ts`).
- E2E (`/home/user/e2e.py`): antecipação, reordenar + confirmar + reload,
  download do backup.

## Pendências (não bloqueiam a Fase 13)

- `MERCADOPAGO_ACCESS_TOKEN` ausente → a geração de Pix real responde 503 com
  mensagem tratada na UI ("Pagamento indisponível: ...").
- `bun run lint` → 3 erros **pré-existentes do zip**:
  `api/routes/assinaturas.ts` (exporta `assinaturasRota`, o lint quer
  `assinaturas`), `packages/mobile/app/_layout.tsx` (import do
  `ErrorBoundary` do template), `web/queries/planos.ts` (não importa
  `../lib/api`).
- `usuarios.proxima_cobranca` segue em DD/MM/AAAA (legado do seed); as contas de
  data passam por `paraIso`/`comoOrigem`. Coluna não migrada de propósito.
- Herdadas do `task.md`: `RESEND_API_KEY`, domínio `playplusnow.com.br` não
  verificado no Resend, pacote "15 em 1" lista 17 serviços, preços provisórios de
  Looke/Telecine/Record+/Hulu, `landing/social-proof.tsx:52` fala "sete boletos".

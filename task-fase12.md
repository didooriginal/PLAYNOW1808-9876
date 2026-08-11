# Fase 12 — Ciclos, ordenação, antecipação, salvar e backup

Números aprovados pelo dono: trimestral 5% · semestral 10% · anual 20%;
antecipar mês vigente 5% (Pix); antecipar próximo mês 10% (Pix).
Backup: Excel (.xlsx), uma aba por tabela. Salvar: automático + botão Confirmar + selo "Salvo".

## 1. Ciclos (mensal/trimestral/semestral/anual) — BACKEND OK
- [x] `api/lib/ciclos.ts` criado: `CICLOS`, `DEFINICOES`, `ANTECIPACAO`, `precificarCiclo`,
      `precificarAntecipacao`, `normalizarCiclo`, `somarMeses` (trata 31/01 + 1 mês = 28/02).
- [x] `lib/pedidos.ts` refatorado: `Ciclo` nos tipos, `PedidoPrecificado` ganhou `meses` e `mensal`.
      Pacote, combo pronto e **combo montado (telas avulsas)** agora respeitam o ciclo.
      No montado, o desconto de ciclo incide DEPOIS do desconto por volume (somam).
      `usuarios.valor` passou a guardar sempre a MENSALIDADE equivalente (`valor / meses`).
      `proximaData` agora usa `somarMeses` e aceita base = vencimento atual.
- [x] `routes/checkout.ts`: `ciclo: z.enum(CICLOS)`.
- [ ] Front do checkout: seletor dos 4 ciclos (hoje só lê `?ciclo=anual`).
- [ ] Front do montador (builder): oferecer ciclo antes de fechar. ← ITEM 1 DO USUÁRIO

## 2. Admin: reordenar grade de apps da landing
- [ ] `schema.ts`: `aplicativos.ordem` integer default 0 + `db:push`.
- [ ] `routes/aplicativos.ts`: procedure `reordenar` (adminOnly) recebendo array de ids.
- [ ] Listagem passa a ordenar por `ordem`, depois `nome`.
- [ ] UI admin: setas ↑/↓ (mais confiável que drag no mobile) + salvar ordem.

## 3. Renovação do cliente com Trimestral/Semestral/Anual
- [ ] Área de pagamento do cliente: escolher ciclo na renovação.

## 4/5. Antecipar pagamento (vigente 5% · próximo 10%, só Pix)
- [ ] Procedure de antecipação usando `precificarAntecipacao`.
- [ ] UI no painel do cliente com os dois cartões.
- [ ] Cuidado: antecipar o próximo mês deve EMPURRAR `proximaCobranca` em 1 mês,
      e não pode ser usado duas vezes para o mesmo mês (idempotência por competência).

## 6. Botão Salvar/Confirmar + selo "Salvo" no admin
- [ ] Mantém auto-save; adiciona feedback visível de estado.

## 7. Backup do banco em Excel
- [ ] Endpoint admin que gera .xlsx com uma aba por tabela.
- [ ] Senhas de contas matrizes: incluir? decidir com o usuário (risco de vazamento).

## Regras que não posso esquecer
- `bun run db:push` sem TTY: `script -qec "bun run db:push --force" /dev/null < /dev/null`.
- Toda UI nova precisa de `Tooltip`/`Ajuda` com texto em `lib/ajuda-admin.ts` (`AJUDA`).
- Nunca editar arquivos `__`.

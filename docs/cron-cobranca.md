# Como fazer os e-mails de cobrança saírem sozinhos

O código já está pronto e testado. Falta só **alguém chamar a rota todo dia**.
Este guia mostra as três formas, da mais recomendada para a mais simples.

---

## O que a rota faz

```
GET https://playplusnow.com.br/api/cron/vencimento
Authorization: Bearer <CRON_SECRET>
```

Numa chamada ela varre todos os clientes pagantes e envia:

| Momento | E-mail |
|---|---|
| 3 a 1 dia **antes** do vencimento | "Sua assinatura vence em X dias" |
| 1 dia **depois** do vencimento | "Sua fatura venceu há 1 dia" |
| 3 dias depois | reforço da cobrança |
| 7 dias depois | "Seu acesso foi suspenso por falta de pagamento" |

Responde algo assim:

```json
{"ok":true,"processados":42,"enviados":3,"falhas":0,"avisoPrevio":1,"atrasados":2,"repetidos":39}
```

**Chamar duas vezes não manda e-mail duplicado.** Cada envio grava uma chave
única em `notificacoes`; a segunda tentativa cai em `repetidos`. Ou seja: pode
chamar de hora em hora sem medo.

**Perder um dia também não perde o e-mail.** A regra é "atraso ≥ marco", não
"atraso = marco". Se o agendador ficar dois dias fora do ar, na volta o cliente
recebe a cobrança certa (e só uma, a do marco mais alto).

Sem o header correto a rota devolve **401**. Sem `CRON_SECRET` no `.env` do
servidor ela fica **desligada (503)** — nunca aberta.

---

## Opção 1 — Cloudflare Cron Trigger (recomendada)

Você já usa a Cloudflare para o domínio e para o Email Worker, então é o
caminho natural: **grátis, sem cadastro novo, sem cartão**.

1. Painel Cloudflare → **Workers & Pages** → **Create** → **Worker**
   → nome `playplusnow-cron` → **Deploy**.
2. **Edit code** → apague o exemplo → cole o conteúdo de
   [`docs/cron-worker.js`](./cron-worker.js) → **Deploy**.
3. **Settings → Variables and Secrets**:

   | Nome | Tipo | Valor |
   |---|---|---|
   | `CRON_URL` | Text | `https://playplusnow.com.br/api/cron/vencimento` |
   | `CRON_SECRET` | **Secret** | o mesmo valor de `CRON_SECRET` no `.env` do servidor |

4. **Settings → Trigger Events → Cron Triggers → Add**:

   ```
   0 12 * * *
   ```

   O cron da Cloudflare é em **UTC**, então `12:00 UTC` = **09:00 de Brasília**.
   (Para 08:00 de Brasília use `0 11 * * *`.)

5. Teste na hora: abra a URL do worker no navegador
   (`https://playplusnow-cron.<sua-conta>.workers.dev`). Ele executa a mesma
   varredura e mostra o JSON da resposta.

Para acompanhar: **Workers → playplusnow-cron → Logs**.

---

## Opção 2 — cron-job.org (sem escrever nada)

Se preferir não mexer em Worker:

1. Crie conta grátis em <https://cron-job.org>.
2. **Create cronjob**:
   - **URL**: `https://playplusnow.com.br/api/cron/vencimento`
   - **Schedule**: todo dia, 09:00, fuso `America/Sao_Paulo`
   - **Advanced → Headers**: `Authorization` = `Bearer <CRON_SECRET>`
3. Salve e clique em **Test run** para conferir o `{"ok":true,...}`.

Desvantagem: o `CRON_SECRET` fica guardado num serviço de terceiros.

---

## Opção 3 — rede de segurança já ativa (não precisa fazer nada)

Mesmo sem agendador nenhum, o sistema tenta se virar: **quando alguém abre o
painel** (admin ou cliente), o servidor roda a varredura de e-mail em segundo
plano, no máximo **1x por hora**.

Isso cobre o dia a dia normal, mas **não substitui o agendador**: se ninguém
abrir o painel num fim de semana, os e-mails daquele período só saem quando
alguém entrar. Como a dedup é por marco, eles não se perdem — só atrasam.

Use isto como plano B, não como plano A.

---

## Conferindo se está funcionando

- **No servidor**: os logs trazem uma linha por execução —
  `[Cron] 2026-08-18 — 42 clientes, 1 avisos prévios, 2 cobranças de atraso, 39 já enviados antes, 0 falhas.`
- **No painel do cliente**: todo e-mail enviado também vira aviso na tela dele.
- **No Resend**: <https://resend.com/emails> mostra entrega, abertura e bounce.

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| `401 não autorizado` | `CRON_SECRET` do agendador diferente do `.env` |
| `503 CRON_SECRET não configurado` | falta a variável no `.env` do servidor |
| `ok:true` mas `enviados:0` | ninguém se encaixa nas datas hoje — normal |
| `falhas` > 0 | erro no Resend; ver o motivo em <https://resend.com/emails> |
| Cliente não recebe | `valor` dele é 0 no cadastro (só cobra quem tem `valor >= 1`) |

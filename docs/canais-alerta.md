# Canais de alerta do admin (WhatsApp + Telegram + e-mail)

Todo alerta de **escopo admin** sai por tres canais ao mesmo tempo, de proposito
(redundancia): WhatsApp (CallMeBot), Telegram (CallMeBot) e e-mail (Resend).

- Hub dos canais: `packages/web/src/api/lib/alertas-canais.ts` (`espalharAlertaSeguro`, `statusCanais`)
- WhatsApp: `packages/web/src/api/services/whatsapp.ts`
- Telegram: `packages/web/src/api/services/telegram.ts`
- E-mail: `packages/web/src/api/services/email.ts`
- Ponto de disparo unico: `dispararWebhook()` em `packages/web/src/api/routes/notificacoes.ts`
  (chamado por `notificar({ escopo: "admin", ... })`)
- Nenhuma falha de canal derruba o fluxo que gerou o alerta.
- No painel: aba **Central de Alertas** -> card **Canais de alerta**, com botao
  **Testar todos os canais** (procedures `notificacoes.canais` e `notificacoes.testarCanais`).

## Status atual dos canais

| Canal | Estado | Observacao |
| --- | --- | --- |
| WhatsApp | instavel | CallMeBot responde `queued` mas a entrega nao chega; problema do bot deles |
| Telegram | pendente de config | falta `TELEGRAM_GRUPO_APIKEY` (e/ou `TELEGRAM_DESTINOS`) no `.env` |
| E-mail | ativo | Resend, nivel padrao `critico` |

## Telegram (CallMeBot)

Variaveis no `.env` da raiz:

```
TELEGRAM_GRUPO_APIKEY="chave-do-grupo"
TELEGRAM_DESTINOS="@usuario1,@usuario2"
```

- Grupo: `https://api.callmebot.com/telegram/group.php?apikey=<key>&text=<url>&html=no`
- Pessoal: `https://api.callmebot.com/text.php?user=@usuario&text=<url>&html=no&links=no`

Como obter a chave do grupo:

1. No Telegram, envie `/start` para **@CallMeBot_txtbot**.
2. Crie (ou use) o grupo da equipe e adicione **@API_CallMeBot** nele.
3. Peque a apikey em `callmebot.com/blog/telegram-group-messages-api-easy/`.
4. Coloque a chave no `.env` (pelo painel da Runable, nunca colada no chat).

Sem essas variaveis o canal aparece **Desligado** no card e e simplesmente ignorado.

## E-mail (Resend)

```
ADMIN_EMAIL="quem-recebe@dominio.com"
ALERTAS_EMAIL_NIVEL="critico"   # critico (padrao) | alerta | todos | off
```

- Destinatario: `emailDoAdmin()` — usa `ADMIN_EMAIL`, senao o primeiro admin do banco.
- `ALERTAS_EMAIL_NIVEL` e o anti-spam: com `critico` so alertas criticos viram e-mail.
- A `RESEND_API_KEY` e restrita a envio, entao nao da para auditar entrega por API —
  confira na caixa de entrada.

---

## WhatsApp (CallMeBot) — detalhes

Todo alerta de **escopo admin** do painel (inadimplência, conta caída, chamado novo e,
principalmente, **"Novo cliente solicitou ativação"** do IPTV) é enviado também para o
WhatsApp da equipe.

- Código: `packages/web/src/api/services/whatsapp.ts`
- Ponto de disparo único: `dispararWebhook()` em `packages/web/src/api/routes/notificacoes.ts`
  (chamado por `notificar({ escopo: "admin", ... })`)
- Falha de rede/limite **nunca** derruba o fluxo que gerou o alerta — o alerta continua
  no painel de qualquer forma.

## Formato da mensagem

```
[URGENTE] Novo cliente solicitou ativação: Diego Dias
MAC: AA:BB:CC:DD:EE:FF · TV Box da sala
```

A marca depende da severidade: `[URGENTE]` (crítico), `[ATENCAO]` (alerta), `[AVISO]` (info).

## Configuração

Uma única variável, no `.env` da raiz:

```
WHATSAPP_DESTINOS="55DDNUMERO:APIKEY,55DDNUMERO:APIKEY"
```

Cada item é `<telefone com DDI, só dígitos>:<apikey do CallMeBot>`.
Itens malformados são ignorados; a apikey nunca é logada.

**Números configurados hoje:** o oficial da empresa (21 96472-7746) e o pessoal
(21 99577-7108). Ambos testados com envio real.

### O número do bot MUDA de destino para destino

Atenção: o CallMeBot usa vários números de bot e **cada destino fica atrelado ao bot
que respondeu a ele**. Não existe um número único. Mapa atual:

| Destino | Bot do CallMeBot |
| --- | --- |
| 21 99577-7108 | **+34 694 25 79 52** |
| 21 96472-7746 | o que respondeu a apikey desse aparelho (confirmar no histórico dele) |

Se um destino para de receber, o bloqueio/arquivamento a checar é o **bot dele**, não o
de outro número.

### Como conseguir a apikey de um número novo

1. No WhatsApp **do número que vai receber**, envie a mensagem
   `I allow callmebot to send me messages` para o bot do CallMeBot
   (o site indica o número da vez; hoje circulam +34 644 51 95 23, +34 694 25 79 52 e
   +34 623 80 11 90).
2. O bot responde com a apikey **daquele número** (a chave é por número, não por conta).
   Anote **qual bot respondeu** — é esse contato que não pode ficar bloqueado ou arquivado.
3. Acrescente `,55DDNUMERO:APIKEY` no fim do `WHATSAPP_DESTINOS`.

### Grupo do WhatsApp: não dá

O FAQ oficial do CallMeBot é explicito: *"Can I send WhatsApp messages to groups? No,
you can only send WhatsApp messages to contacts."* Grupo só funciona no Telegram deles.
Para grupo de WhatsApp de verdade seria TextMeBot (pago) ou a Meta Cloud API.

Para remover um número da lista, basta apagar o item dele — nada mais precisa mudar.

## Produção

O `.env` da raiz é local. Em produção as variáveis são configuradas no painel da Runable;
sem `WHATSAPP_DESTINOS` lá, o WhatsApp simplesmente não dispara (o painel continua
mostrando os alertas normalmente).

## Por que CallMeBot e não a API oficial da Meta

A mensagem vai para **nós**, nunca para o cliente: não existe exigência de template
aprovado nem janela de 24h, o volume é baixíssimo e é só uma chamada GET — sem SDK, sem
VPS e sem custo. Se algum dia precisarmos falar com o **cliente** por WhatsApp, aí o
caminho certo passa a ser a Meta Cloud API.

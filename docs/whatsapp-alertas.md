# Alertas do admin no WhatsApp (CallMeBot)

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

### Como conseguir a apikey de um número novo

1. No WhatsApp **do número que vai receber**, envie a mensagem
   `I allow callmebot to send me messages` para **+34 644 51 95 23**.
2. O bot responde com a apikey **daquele número** (a chave é por número, não por conta).
3. Acrescente `,55DDNUMERO:APIKEY` no fim do `WHATSAPP_DESTINOS`.

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

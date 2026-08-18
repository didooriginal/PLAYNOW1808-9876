# Captura automática dos códigos — Cloudflare Email Routing + Email Worker

Guia do zero: criar a conta na Cloudflare, apontar o domínio, ligar o Email Routing,
subir o Worker e mandar os e-mails de código da Netflix (e dos outros apps) caírem
sozinhos na Central de Códigos do PLAYPLUSNOW.

Resultado final:

```
Netflix envia o código
   ↓  (para o e-mail da conta matriz)
Gmail da matriz encaminha  →  netflix01@mail.playplusnow.com.br
   ↓  (Cloudflare Email Routing, regra catch-all)
Email Worker (roda na Cloudflare, de graça)
   ↓  POST JSON
https://playplusnow.com.br/api/webhooks/email
   ↓
backend extrai o código, acha a conta matriz pelo endereço de captura
e entrega ao cliente que clicou em "Pedi o código agora"
```

Nada de IMAP, nada de senha de app guardada no banco.

---

## 0. O que você precisa antes de começar

| Item | Por quê |
| --- | --- |
| Domínio `playplusnow.com.br` (registro.br) | é onde o subdomínio `mail.` vai morar |
| Acesso ao Gmail (ou e-mail) de cada conta matriz | para criar a regra de encaminhamento |
| Um e-mail pessoal seu (Gmail, Outlook…) | a Cloudflare exige um destino verificado |
| O site já publicado em `https://playplusnow.com.br` | o Worker precisa de uma URL pública para chamar |

Custo: **R$ 0**. Email Routing é gratuito e o plano free do Workers dá 100 mil
execuções por dia — muito acima do que esse fluxo usa.

---

## 1. Criar a conta na Cloudflare

1. Acesse <https://dash.cloudflare.com/sign-up>.
2. Informe e-mail + senha forte → **Create Account**.
3. Confirme o e-mail que a Cloudflare envia (link "Verify email").
4. Faça login. Se aparecer tela de escolha de plano, escolha **Free**.
5. Recomendado: **My Profile → Authentication → Two-factor authentication**.
   Essa conta passa a controlar o e-mail do domínio; proteja com 2FA.

---

## 2. Adicionar o domínio à Cloudflare

O Email Routing só funciona se a **zona DNS** do domínio estiver na Cloudflare.

1. Painel → **Add a domain** (ou **+ Add** → Existing domain).
2. Digite `playplusnow.com.br` → **Continue**.
3. Escolha o plano **Free** → **Continue**.
4. A Cloudflare importa os registros DNS atuais. **Confira** se estão lá:
   - o registro que aponta para a hospedagem do site (A / CNAME),
   - registros de e-mail que você já use (MX, TXT/SPF, DKIM),
   - qualquer verificação (Resend, Google, Mercado Pago).
   Se faltar algo, adicione manualmente antes de trocar os nameservers.
5. A Cloudflare mostra **2 nameservers**, tipo:
   ```
   xxxx.ns.cloudflare.com
   yyyy.ns.cloudflare.com
   ```
6. Entre no **registro.br** → domínio `playplusnow.com.br` → **Alterar servidores DNS**
   → apague os atuais → cole os dois da Cloudflare → salvar.
7. Volte na Cloudflare → **Check nameservers now**. A propagação costuma levar de
   alguns minutos a algumas horas. Quando o status virar **Active**, siga.

> Se o domínio **já estava** na Cloudflare, pule direto para o passo 3.

⚠️ Enquanto os nameservers propagam, o site pode oscilar. Faça essa troca num
horário de baixo movimento.

---

## 3. Ligar o Email Routing

1. Painel → selecione `playplusnow.com.br`.
2. Menu lateral → **Compute** → **Email Service** → **Email Routing**
   (em contas mais antigas aparece como **Email** → **Email Routing**).
3. **Get started / Enable Email Routing**.
4. A Cloudflare pede para criar os registros DNS dela (**MX** + **TXT/SPF**) →
   clique em **Add records and enable**.

   ⚠️ **Atenção ao MX.** Se o domínio raiz `playplusnow.com.br` já recebe e-mail em
   outro provedor (Google Workspace, Zoho, Titan…), **NÃO** deixe a Cloudflare
   sobrescrever o MX da raiz — você perderia esses e-mails. Nesse caso:
   - habilite o Email Routing normalmente,
   - depois, em **DNS → Records**, garanta que o MX da raiz continua o do seu
     provedor e que os MX da Cloudflare estão no **subdomínio `mail`**
     (`mail.playplusnow.com.br`).
   Se a raiz não recebe nada hoje, pode aceitar como a Cloudflare sugere.

5. **Destination addresses** → **Add destination address** → coloque seu e-mail
   pessoal → confirme o link de verificação que chega nele. Esse destino é só
   para você receber avisos e testar; os códigos vão para o Worker.

### 3.1 Usar o subdomínio `mail.playplusnow.com.br`

Todos os endereços de captura vivem em `mail.playplusnow.com.br` — assim o e-mail
"de verdade" do domínio raiz continua intacto.

1. Ainda em **Email Routing** → aba **Settings** → **Custom domains** (ou
   **Subdomains**) → **Add subdomain** → `mail`.
2. A Cloudflare cria os MX/TXT desse subdomínio. Aceite.
3. Confirme em **DNS → Records** que existem entradas `mail` do tipo MX apontando
   para `*.mx.cloudflare.net`.

> Se sua conta não oferecer subdomínio no Email Routing, use a raiz mesmo
> (`netflix01@playplusnow.com.br`) — mas só se a raiz **não** estiver em uso por
> outro provedor de e-mail. O sistema aceita qualquer endereço; ele só precisa
> bater com o campo "E-mail de captura" da conta matriz no admin.

---

## 4. Criar o Email Worker

O Worker é o pedacinho de código que recebe o e-mail e faz o POST no site.
O arquivo pronto está em `docs/email-worker.js` deste repositório.

### Caminho A — pelo painel (mais simples)

1. Painel → **Compute (Workers)** → **Workers & Pages** → **Create** →
   **Create Worker**.
2. Nome: `playplusnow-email` → **Deploy** (ele sobe um "Hello World").
3. **Edit code**.
4. Apague tudo e cole o conteúdo de `docs/email-worker.js`.
5. O arquivo importa `postal-mime` (parser de e-mail). No editor do painel, o
   import de pacote npm é resolvido automaticamente no deploy; se der erro de
   módulo, use o Caminho B.
6. **Deploy**.
7. Volte no Worker → **Settings** → **Variables and Secrets** → adicione:

   | Nome | Tipo | Valor |
   | --- | --- | --- |
   | `WEBHOOK_URL` | Text | `https://playplusnow.com.br/api/webhooks/email` |
   | `WEBHOOK_TOKEN` | Secret | o mesmo valor de `EMAIL_WEBHOOK_TOKEN` do `.env` do servidor |

8. **Deploy** de novo para aplicar as variáveis.

### Caminho B — pelo terminal (wrangler)

```bash
mkdir playplusnow-email && cd playplusnow-email
npm init -y
npm i postal-mime
npm i -D wrangler

# copie o worker
cp /caminho/do/repo/docs/email-worker.js src/index.js
```

`wrangler.toml`:

```toml
name = "playplusnow-email"
main = "src/index.js"
compatibility_date = "2026-01-01"

[vars]
WEBHOOK_URL = "https://playplusnow.com.br/api/webhooks/email"
```

```bash
npx wrangler login
npx wrangler secret put WEBHOOK_TOKEN   # cola o valor do EMAIL_WEBHOOK_TOKEN
npx wrangler deploy
```

### 4.1 O token

No `.env` da raiz do projeto (mesmo arquivo do `DATABASE_URL`):

```
EMAIL_WEBHOOK_TOKEN=<uma string aleatória longa>
```

Gere com:

```bash
openssl rand -hex 32
```

O Worker manda esse valor no header `x-webhook-token`. Se o `.env` tiver o token
e o header não bater, o webhook responde **401** e nada é gravado. Se você deixar
`EMAIL_WEBHOOK_TOKEN` vazio, o webhook aceita sem token (não recomendado em
produção: qualquer um poderia injetar códigos falsos).

Depois de mexer no `.env`, **reinicie o servidor** para ele carregar a variável.

---

## 5. Apontar o catch-all para o Worker

1. **Email Routing** → aba **Routing rules**.
2. Desça até **Catch-all address** → **Edit**.
3. **Action** = **Send to a Worker** → selecione `playplusnow-email`.
4. Deixe **Enabled** → **Save**.

Pronto: **qualquer** endereço em `mail.playplusnow.com.br` (`netflix01@…`,
`disney03@…`, `hbo07@…`) passa a cair no Worker. Você não precisa cadastrar cada
endereço na Cloudflare — quem define o endereço é o campo "E-mail de captura" da
conta matriz no admin.

> Se você tiver regras individuais ("Custom addresses") criadas antes, elas têm
> prioridade sobre o catch-all. Verifique se nenhuma delas captura os endereços
> dos streamings.

---

## 6. Configurar cada conta matriz

Para cada conta matriz (ex.: a primeira Netflix):

1. **No admin do PLAYPLUSNOW** → aba **Contas** → abra a conta matriz →
   campo **"E-mail de captura de códigos"** → clique em **sugerir** ou digite
   `netflix01@mail.playplusnow.com.br` → salvar.
   O padrão sugerido é `slug + número sequencial @ mail.playplusnow.com.br`.
2. **No e-mail da conta matriz**, escolha um dos dois caminhos:

   **Opção 1 — encaminhamento no Gmail (não mexe na Netflix):**
   - Gmail da matriz → ⚙️ **Ver todas as configurações** →
     **Encaminhamento e POP/IMAP** → **Adicionar um endereço de encaminhamento**
     → `netflix01@mail.playplusnow.com.br`.
   - O Gmail manda um e-mail de confirmação para esse endereço, e ele cai no
     Worker — **não** na sua caixa. O Worker já resolve isso: ele reconhece as
     confirmações de encaminhamento e **reenvia para o `ADMIN_EMAIL`**, sem
     tentar extrair código. Para funcionar, duas condições:
     - a variável **`ADMIN_EMAIL`** está configurada no Worker
       (Settings → Variables) com o seu e-mail pessoal;
     - esse mesmo e-mail está **verificado** em Email Routing →
       **Destination addresses** (a Cloudflare só reenvia para destino
       verificado). Se não estiver verificado, o reenvio falha e o e-mail segue
       para o webhook — você vê o erro em **Workers → Logs**.

     Se você ainda não subiu essa versão do Worker, o plano B manual continua
     valendo: crie uma regra "Custom address" para `netflix01@…` →
     **Send to an email** (seu e-mail), confirme e apague a regra depois.
   - Confirmado, ative o encaminhamento. Para não encaminhar tudo, use
     **Filtros** → "De: `info@account.netflix.com`" → ação **Encaminhar para**.

   **Opção 2 — trocar o e-mail de login da matriz:**
   - Netflix → Conta → alterar e-mail para `netflix01@mail.playplusnow.com.br`.
   - Mais limpo (só chega o que interessa), mas a Netflix envia um e-mail de
     confirmação para o **endereço antigo** e você perde o acesso "humano" à conta
     por e-mail. Só faça isso se estiver confortável com o fluxo.

   👉 Recomendação: comece pela **Opção 1** com filtro por remetente.

3. Repita para as outras matrizes (Disney, Prime, HBO, Paramount…), cada uma com
   seu próprio endereço de captura.

---

## 7. Testar

### 7.1 Webhook sozinho (sem Cloudflare)

```bash
curl -i -X POST https://playplusnow.com.br/api/webhooks/email \
  -H "content-type: application/json" \
  -H "x-webhook-token: SEU_TOKEN" \
  -d '{
    "remetente": "info@account.netflix.com",
    "destinatario": "netflix01@mail.playplusnow.com.br",
    "assunto": "Seu codigo de acesso temporario da Netflix",
    "corpo": "Use o codigo 1234 para continuar assistindo."
  }'
```

Esperado: `200 {"ok":true,"codigo":"1234"}`. No admin, aba **Códigos**, o registro
aparece com a conta matriz identificada.

### 7.2 Fluxo completo

1. No painel do cliente, clique em **"Pedi o código agora"**.
2. Dispare o `curl` acima (ou peça o código de verdade na Netflix).
3. O código deve aparecer na tela do cliente em poucos segundos, com contagem de
   **15 minutos**.
4. Sem ninguém ter pedido, o código entra como **"sem dono"** — visível só no admin.

### 7.3 Ver os logs do Worker

Painel → Worker `playplusnow-email` → **Logs** → **Begin log stream**. Mande um
e-mail de teste para `netflix01@mail.playplusnow.com.br` e acompanhe. Ou:

```bash
npx wrangler tail playplusnow-email
```

---

## 8. Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| E-mail volta com "550 relay not permitted" | Email Routing não habilitado ou MX faltando no subdomínio | DNS → confira os MX `*.mx.cloudflare.net` em `mail` |
| Worker não roda | catch-all ainda está como "Send to an email" ou desabilitado | Routing rules → Catch-all → Send to a Worker |
| Webhook responde **401** | `WEBHOOK_TOKEN` do Worker ≠ `EMAIL_WEBHOOK_TOKEN` do servidor | igualar os dois e reiniciar o servidor |
| Webhook responde **422 "e-mail sem código"** | remetente/formato novo que o parser não reconhece | ver o e-mail bruto nos logs e ajustar `extrairCodigo` em `src/api/routes/codigos.ts` |
| Código entra "sem dono" | ninguém clicou em "Pedi o código agora" nos últimos 10 min, ou o "E-mail de captura" da matriz está vazio/diferente | preencher o campo no admin exatamente igual ao endereço usado |
| Confirmação do Gmail nunca chega | ela foi entregue ao Worker | configure `ADMIN_EMAIL` no Worker **e** verifique esse e-mail em Destination addresses (item 6, Opção 1). Confira **Workers → Logs**: `reenviado para o admin` = deu certo; `nao consegui reenviar` = destino não verificado |
| E-mail normal do domínio parou de chegar | MX da raiz sobrescrito pela Cloudflare | restaurar o MX do provedor original na raiz |

---

## 9. Checklist final

- [ ] Conta Cloudflare criada, e-mail verificado, 2FA ligado
- [ ] `playplusnow.com.br` **Active** na Cloudflare, DNS do site conferido
- [ ] Email Routing habilitado + destino pessoal verificado
- [ ] `ADMIN_EMAIL` configurado no Worker (recebe as confirmações de encaminhamento)
- [ ] Subdomínio `mail.playplusnow.com.br` com MX próprios
- [ ] Worker `playplusnow-email` publicado com `WEBHOOK_URL` e `WEBHOOK_TOKEN`
- [ ] `EMAIL_WEBHOOK_TOKEN` no `.env` do servidor (mesmo valor) e servidor reiniciado
- [ ] Catch-all → **Send to a Worker**
- [ ] "E-mail de captura" preenchido em **todas** as contas matrizes
- [ ] Encaminhamento (ou troca de e-mail) feito em cada matriz
- [ ] Teste do `curl` → 200, teste do fluxo completo com pedido do cliente → código na tela

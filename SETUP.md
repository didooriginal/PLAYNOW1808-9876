# PLAYPLUSNOW — ambiente restaurado (09/08/2026)

Projeto clonado do zip `PLAYPLUSNOW-3369-main`, reinstalado no template gerenciado
Runable (mesma versão, `0.3.0`), com banco Turso novo provisionado e populado.

## Como rodar

```bash
cd /home/user/playplusnow
bun install                  # já feito
bun run dev                  # web + API na porta 4200 (http://localhost:4200)
bun run dev:desktop          # Electron, porta 4400 (opcional)
bun run dev:mobile           # Expo, porta 4300 (opcional)
bun run build                # verifica compilação (web + desktop)
bun run typecheck            # 3/3 OK
```

Dev server hoje roda numa sessão tmux chamada `dev` (`tmux attach -t dev`).

## Banco de dados (Turso)

O `.env` **não vem no zip** (é gitignored) — foi o que quebrava tudo em runtime.
Agora existe um `/home/user/playplusnow/.env` com um banco Turso gerenciado novo,
já com `DATABASE_URL` + `DATABASE_AUTH_TOKEN`, além de storage S3, AI gateway,
`BETTER_AUTH_SECRET` e `WEBSITE_URL`.

Tabelas aplicadas (`bun run db:push`): `pacotes`, `contas_matrizes`, `usuarios`,
`aplicativos`, `alocacoes`, `chamados`, `recompensas_progresso`, `recompensas_eventos`,
`combos`, `codigos_otp`, `solicitacoes_tv`, `notificacoes`, `historico_vencimento`,
`faturas` + tabelas do Better Auth (`user`, `session`, `account`, `verification`).

### Trocar para o SEU banco Turso

1. Edite **apenas** o `.env` da raiz (nunca crie `.env.local`, o lint recusa):
   ```
   DATABASE_URL=libsql://seu-banco.turso.io
   DATABASE_AUTH_TOKEN=seu-token
   ```
2. Aplique o schema e popule:
   ```bash
   cd packages/web
   bun run db:push        # cria/atualiza as tabelas
   bun run seed           # popula pacotes, contas matrizes e clientes (só se estiver vazio)
   bun run seed -- force  # apaga e recria os dados de demonstração
   ```
3. Reinicie o dev server.

Comandos de schema: `bun run db:colunas` (PADRAO - aditivo e seguro),
`bun run db:generate` + `bun run db:migrate` (migrations versionadas) e
`bun run db:push` (PERIGOSO, ver aviso abaixo).

### PERIGO: `db:push` apaga dados ao adicionar coluna NOT NULL

Em 20/08/2026 o `drizzle-kit push` (dialect `turso`) apagou as **56 linhas de
`contas_matrizes`** ao adicionar tres colunas NOT NULL. O plano que ele executa e:

```sql
delete from contas_matrizes;
ALTER TABLE `contas_matrizes` ADD `vagas_travadas` integer DEFAULT false NOT NULL;
...
```

O `delete from` vem antes dos `ALTER`. Com TTY o drizzle-kit pergunta antes; o
`--force` (usado para rodar sem TTY no sandbox) aceita a perda sem perguntar.
Reproduzido em banco local: 5 linhas -> 0 linhas.

**Regra:** para adicionar colunas use sempre

```bash
bun run db:colunas            # mostra o plano (dry run)
bun run db:colunas -- aplicar # roda so ALTER TABLE ... ADD COLUMN
```

Ele compara `schema.ts` com o banco e nunca roda DELETE/DROP. Use `db:push`
apenas para criar tabela nova ou mudanca de tipo, com `bun run db:backup`
antes, com TTY, lendo o plano statement por statement - **nunca com `--force`**.

## Scripts novos (criados nesta restauração)

| Comando (em `packages/web`) | O que faz |
|---|---|
| `bun run seed` | Roda o seed sem precisar de sessão de admin (o `seed.run` da API exige login admin). Reaproveita a mesma função `executarSeed`. |
| `bun run admin <email>` | Marca um usuário como administrador. `bun run admin <email> remover` desfaz. |

Única mudança de código: `src/api/routes/seed.ts` passou a exportar `executarSeed()`,
usada tanto pela procedure `seed.run` quanto pelo script. Nenhuma tela foi alterada.

## Contas de teste criadas

| Papel | E-mail | Senha |
|---|---|---|
| Admin (`/admin`) | `admin@playplusnow.com` | `Admin@2026` |
| Cliente (`/dashboard`) | `diego.silva@email.com` | `Cliente@2026` |

O cadastro do cliente caiu em cima da linha já existente do seed (Diego Dias Silva,
pacote Mega Promo), então o painel abre com dados reais. Troque as senhas antes de
qualquer uso real.

## Dados populados

- 3 pacotes (Pacote 03, Mega Promo, 15 em 1)
- 15 contas matrizes (Netflix, Disney+, HBO Max, Spotify, Prime, YouTube, IPTV…)
- 8 clientes + 1 conta admin

## Verificado nesta restauração

- `bun install` OK · `bun run typecheck` 3/3 OK · `bun run build` 2/2 OK
- `/`, `/dashboard`, `/setup` e `/admin` (logado) sem erro de console ou pageerror,
  `overflowX = 0` em 1440px **e** 390px
- Todas as abas novas de admin e do painel do cliente abrem com dados reais, sem
  overflow e sem erro de console
- Fluxo Pix ponta a ponta: BR Code gerado → webhook `{"txid":"..."}` → cobrança `pago`,
  fatura quitada e cliente reativado com nova data de cobrança
- Motor de comissão validado: rede de 3 indicados, carteira com R$ 92,23 disponíveis,
  67% da rede em dia
- IA responde regra de uso corretamente e escala ao suporte fora da base

## Atualização estrutural (10/08/2026)

Sete blocos implementados por cima da restauração:

1. **Landing** — contador de 1.540 assinaturas, comparativo com preços oficiais dos
   serviços e 5 depoimentos reais. Removida qualquer menção a "garantia de 7 dias".
2. **Netflix + IA** — desbloqueio de Netflix e assistente treinado nas regras de uso
   (`src/api/agent/conhecimento.ts`), com escalonamento educado ao suporte quando a
   pergunta sai da base.
3. **Fidelidade e segurança** — checklist de uso, contador de fidelidade, bloqueio de
   inadimplente e trava de troca de vencimento (1x a cada 6 meses).
4. **Financeiro / afiliados / recompensas** — comissão de 5%, saque (mín. R$ 10, taxa
   R$ 3,50 configurável) ou crédito com bônus de +25%, bônus de performance +1% com
   meta de 90% da rede em dia, Pix automático e contador de economia.
5. **Risco / estoque / recuperação** — anti-fraude por IP e dispositivo, painel de saúde
   das contas, alerta de ocupação em 95% e win-back automático acima de 15 dias.
6. **Gestão de contas matriz** — controle de gift cards, movimentações e alerta de saldo
   crítico por conta.
7. **Sala de Jogos** — R$ 9,90/mês, pool próprio de contas e liberação automática de
   credenciais (expiram em 12h).

### Novas tabelas

`configuracoes`, `movimentacoes_gift`, `carteiras`, `comissoes`, `saques`,
`cobrancas_pix`, `liberacoes_jogos`, `winback_envios` — mais campos novos em
`contas_matrizes` e `usuarios`.

### Novas rotas de API

`afiliados`, `giftcards`, `jogos`, `saude`, `winback`, `pix`, além do webhook
`POST /api/webhooks/pix` (body `{"txid":"..."}`) que confirma a cobrança, quita a fatura
e reativa o cliente.

### Parâmetros configuráveis

Ficam na tabela `configuracoes`, com defaults em `src/api/lib/config.ts`
(`PARAMETROS_PADRAO`): percentual de comissão, saque mínimo, taxa de saque, bônus de
crédito, bônus de performance, preço da Sala de Jogos, limites de ocupação e win-back.

### Gateway Pix

Implementado como adaptador em modo **simulado** — gera BR Code válido para teste e é
confirmado pelo webhook. Basta plugar o provedor real depois e definir
`PIX_WEBHOOK_TOKEN`.

## Pendências conhecidas (pré-existentes, não bloqueiam rodar)

1. `bun run lint` tem **1 erro restante**: `packages/mobile/app/_layout.tsx` importa
   `components/__ErrorBoundary` enquanto a convenção pede `components/ErrorBoundary`. O
   arquivo real tem prefixo `__` (gerenciado pelo template), então não dá para corrigir
   sem editá-lo. Não afeta dev, build nem typecheck. As outras 13 violações (rotas
   `xRoutes` e `queries/planos.ts`, agora em `lib/planos.ts`) já foram normalizadas.
2. Continuam mockados de propósito: novidades/upgrades, stats sociais e série histórica
   de MRR.
3. Integrações que dependem de credenciais externas ainda não configuradas:
   `EMAIL_WEBHOOK_TOKEN` (webhook de inbound email da Central de Códigos),
   `PIX_WEBHOOK_TOKEN` (gateway Pix está em modo simulado) e o aviso por
   WhatsApp/CallMeBot.
4. Definir se o banco Turso provisionado aqui continua ou se aponto para o seu.

## Checkout na plataforma (10/08/2026)

Todos os botões de compra passaram a fechar dentro do site. O WhatsApp ficou
apenas para suporte.

- Rota nova: **`/checkout`** — aceita `?plano=<id>&ciclo=mensal|anual`,
  `?combo=<id>`, `?apps=netflix,disney,...` e `?jogos=1`.
- Procedures novas: `checkout.resumo`, `checkout.pagar`, `checkout.status`,
  `checkout.meusPedidos` (arquivo `packages/web/src/api/routes/checkout.ts`).
- Regra de ouro: o front envia só a escolha; **o servidor precifica** pela
  tabela do banco (`pacotes`, `combos`, `aplicativos`) em
  `packages/web/src/api/lib/pedidos.ts`.
- Colunas novas em `cobrancas_pix`: `descricao` (texto do que está sendo
  cobrado) e `pedido` (JSON do pedido, aplicado automaticamente na baixa).
- Baixa do pagamento (webhook do provedor ou clique do admin) passa por
  `confirmarPagamento`: quita a fatura, ativa o pacote/combo/apps comprados,
  liga a Sala de Jogos quando for o caso, devolve o cliente para `ativo`,
  empurra o vencimento para o próximo ciclo e apura a comissão do indicador.
- Teste manual do fluxo:
  `curl -X POST localhost:4200/api/webhooks/pix -H 'content-type: application/json' -d '{"txid":"<txid>"}'`

## Recuperação de senha (esqueci minha senha)

- Cliente: `/login` → "Esqueci minha senha" → `/esqueci-senha` → link chega por e-mail → `/redefinir-senha?token=...`
- Link de uso único, validade de 1 hora. Trocar a senha invalida o link.
- Admin: aba **Senhas & Acesso** no `/admin` — fila de pedidos, botão "Resetar senha de um cliente" (gera link) e copiar link para mandar no WhatsApp.
- Servidor: `api/services/email.ts` (Resend), `api/lib/senha.ts`, `api/routes/senha.ts`, hooks `sendResetPassword` / `onPasswordReset` em `api/auth.ts`.
- Tabela nova: `resets_senha`.
- Env: `RESEND_API_KEY` (configurada) e `EMAIL_REMETENTE` (opcional).
- **Limitação atual:** sem domínio verificado no Resend, o envio só entrega em `playnowplus01@gmail.com` (e-mail dono da conta). Para os demais clientes, o admin copia o link da fila. Ao verificar um domínio, preencher `EMAIL_REMETENTE` — nenhuma mudança de código é necessária.

## Central de Códigos 2.0 — entrega automática (17/08/2026)

Antes o painel do cliente mostrava "o último código recebido" da conta matriz — o que
significava que dois clientes da mesma conta podiam ver o código um do outro. Agora o
código tem **dono**.

### Como o código chega no sistema

1. Cada conta matriz ganha um endereço de captura no nosso domínio, cadastrado no admin
   em **Estoque → editar conta → "E-mail de captura de códigos"** (botão *sugerir* gera
   `netflix07@mail.playplusnow.com.br`).
2. **Cloudflare Email Routing** com regra **catch-all** em `mail.playplusnow.com.br`
   entrega tudo para um **Email Worker**.
3. O Worker (código pronto em `docs/email-worker.js`) faz `POST` em
   `/api/webhooks/email` com `remetente`, `destinatario`, `assunto` e `corpo`, usando
   `Authorization: Bearer <EMAIL_WEBHOOK_TOKEN>`.
4. O backend extrai o código, identifica o serviço pelo remetente e casa a conta pelo
   **e-mail de login OU pelo e-mail de captura**.

Nada de IMAP e nenhuma senha de e-mail guardada no banco.

### Como o código encontra o dono

- O cliente clica em **"Pedi o código agora"** no painel (bloco que aparece na Netflix e
  no modal "Como acessar" de todos os apps). Isso abre um **pedido** válido por 10 min.
- Quando o e-mail chega, o código é casado com o pedido `aguardando` mais antigo da
  **mesma matriz + mesmo serviço** (FIFO) — tabela `pedidos_codigo`.
- O código entregue vale **15 minutos** e some na hora se o cliente clicar em
  **"já usei este código"**.
- Sem pedido casado, o código fica **sem dono**: não aparece em painel nenhum, só na
  Central de Códigos do admin (com selo *"sem dono — ninguém pediu"* e a lista
  **"Pedidos abertos agora"**).

### Netflix

O painel agora traz o botão **"Conectar minha TV"** (abre `netflix.com/tv2` em nova aba)
e um aviso destacado para **nunca clicar em "Atualizar residência"** — essa opção troca o
endereço principal da conta e derruba todos os clientes da matriz.

> Atenção: "Estou viajando" / código por e-mail é um recurso de acesso temporário da
> Netflix. Uso recorrente pode levar a Netflix a mudar o fluxo ou bloquear a conta — vale
> manter o caminho do `tv2` como alternativa e não depender só do código por e-mail.

### O que falta configurar (fora do código)

- Habilitar o Email Routing e publicar o Worker (`docs/email-worker.js`).
- Trocar o e-mail de login das matrizes para o endereço de captura **ou** ligar o
  encaminhamento no Gmail de cada matriz.
- Preencher "E-mail de captura de códigos" em cada conta matriz no admin.

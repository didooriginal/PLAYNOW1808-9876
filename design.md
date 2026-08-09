# PLAPLUSNOW — Design

SaaS brasileiro de venda e gestão de pacotes de streaming compartilhados. Ships on **web** (Vite + React + Tailwind 4). Visual: dark-mode futurista/tech, glassmorphism intenso, luzes neon (vermelho elétrico, ciano, roxo). Job: converter visitante em assinante de combo de streamings e dar a ele/ao admin um painel de gestão dos acessos.

Escopo atual: **backend real** em Turso/SQLite + Drizzle, com autenticacao (Better Auth) e papeis cliente/admin. Vem do banco: `pacotes`, `contas_matrizes`, `usuarios`, `aplicativos`, `alocacoes`, `chamados`, `recompensas_progresso`, `recompensas_eventos` e `faturas`. Restam em `src/web/lib/mock-data.ts` apenas o catalogo estatico de servicos e o conteudo editorial da landing (depoimentos, stats) mais as vitrines de upgrades/novidades.

## Brand & Colors

Tokens em `packages/web/src/web/styles.css` (dark-only, `.dark` aplicado no `<html>`).

| Token | Valor | Uso |
|-------|-------|-----|
| background | `#09090b` | Fundo da página |
| surface | `#0f0f13` | Blocos sólidos, faixas |
| glass | `rgba(255,255,255,0.04)` + `backdrop-blur-xl` | Cartões translúcidos |
| border | `rgba(255,255,255,0.08)` | Hairlines dos vidros |
| neon-red | `#ff1f3d` | Marca, logo, CTA principal, "esgotado" |
| neon-cyan | `#22d3ee` | Dados, preços, estados ativos |
| neon-purple | `#a855f7` | Destaques secundários, badges premium |
| foreground | `#fafafa` | Texto primário |
| muted | `#8b8b96` | Texto secundário |
| success | `#22c55e` | Vagas livres, pago |
| warning | `#f59e0b` | Faturas a vencer |

Regras de neon: brilho vem de `box-shadow` colorido de baixa opacidade + borda 1px colorida. Nunca usar neon como cor de texto longo — só em números, títulos curtos, ícones e bordas.

## Typography

- **Display**: `Sora` (600/700/800) — títulos, preços, logo.
- **Body**: `Outfit` (400/500/600) — parágrafos, labels, tabelas.
- Carregadas via `<link>` do Google Fonts em `packages/web/index.html`.
- Logo: "PLAY PLUS" em `text-xs tracking-[0.5em]` acima de "NOW" em display 800 com `-webkit-text-stroke` e glow vermelho.

## Pages

- **Landing** (`src/web/pages/index.tsx`) - header, hero de economia, comparativo caro vs. combo, toggle Mensal/Anual + pacotes prontos, montador a la carte com calculadora flutuante, prova social, footer.
- **Login / Signup** (`pages/login.tsx`, `pages/signup.tsx`) - Better Auth por e-mail e senha. O signup le `?ref=CODIGO`, valida o codigo na API e mostra o banner "Voce foi indicado por X" antes de vincular a indicacao.
- **Painel do Cliente** (`pages/dashboard.tsx`) - sidebar: Meus Acessos, Jornada, Novidades e Upgrades, Faturas, Suporte. Cards de app com e-mail + ver/copiar senha, alertas de vencimento, abertura de chamados.
- **Painel Admin** (`pages/admin.tsx`) - sidebar: Visao Geral, Contas, Apps, Clientes, Pacotes, Faturas, Afiliados, Suporte. KPIs, grafico de receita real, lotacao das contas matrizes, edicao de vagas, faturas com baixa manual e gestao de premios.

## Gamificacao e Indicacoes

- **Fonte de verdade derivada**: `recalcularProgresso(clienteId)` (`api/routes/recompensas.ts`) recalcula tudo a partir do historico real (tempo de assinatura, status de pagamento, indicados convertidos). Nada e pontuado a mao.
- **Idempotencia**: cada marco vira um evento em `recompensas_eventos` com `chave` unica por cliente (`renovacao:3`, `indicacao:12`, `missao:m5`). Rodar de novo nunca duplica XP e o livro-razao serve de auditoria. O recalculo faz batch (1 SELECT + 1 INSERT) para nao pesar a aba do admin.
- **XP**: renovacao em dia +50, indicacao que vira assinante +150. `XP_POR_NIVEL = 250`. Niveis: Iniciante, Bronze, Prata, Ouro, Platina, Diamante, Lenda PPN.
- **7 missoes** (trilha visual numerada em `components/cliente/jornada.tsx`): m1 1 renovacao - m2 3 renovacoes (cupom `PPN15OFF`, 15% OFF) - m3 5 renovacoes - m4 1 indicacao assinante - m5 3 indicacoes (mes de HBO Max) - m6 10 renovacoes - m7 12 meses ativo (presente surpresa). Os tres ultimos premios notificam o admin.
- **Cupom**: quando ativo, aparece na fatura em aberto do cliente (valor cheio riscado + valor final) e na cobranca pendente do admin, inclusive na mensagem de WhatsApp.
- **Link de indicacao**: `usuarios.referral_code` gerado sob demanda; o convidado entra por `/signup?ref=CODIGO` e grava `usuarios.indicado_por`.

## Faturas

- Tabela `faturas` com chave unica `cliente_id + competencia` ("YYYY-MM"). Ninguem cria fatura na mao: `gerarFaturas()` monta a serie completa a partir de `clienteDesde` + `ciclo` + `valor` e e idempotente, no mesmo padrao da gamificacao.
- Competencias passadas nascem `pago`; a corrente fica `aberto`, ou `vencido` quando o cliente esta inadimplente e o vencimento ja passou.
- O cupom da Jornada e reaplicado sempre na fatura em aberto mais recente (`valor` cheio, `desconto`, `valor_final`).
- Cliente ve historico, total pago e "Economia com a Jornada". Admin ve KPIs reais (a vencer, recebido, vencidas, desconto concedido), filtro pendentes/pagas/todas, baixa manual (`Dar baixa` / `Reabrir`, que reajusta `statusPagamento`) e cobranca no WhatsApp com o valor ja com desconto.
- Grafico "Receita faturada" (`faturas.serie`) usa receita RECONHECIDA: fatura anual e rateada nos 12 meses que cobre, senao o mes da cobranca viraria um pico isolado.

## Key User Flows

1. Landing -> escolhe ciclo -> "Garantir Vaga" -> WhatsApp com mensagem pre-preenchida.
2. Landing -> montador a la carte -> calculadora soma em tempo real -> "Finalizar via WhatsApp".
3. Cliente em `/dashboard` -> ve pacote ativo -> revela/copia senha de cada app -> abre chamado no Suporte.
4. Cliente na aba Jornada -> ve nivel, XP e trilha de missoes -> copia/compartilha o link de indicacao -> acompanha premios liberados.
5. Convidado abre `/signup?ref=` -> se cadastra -> vira assinante -> +150 XP para quem indicou, visivel na aba Afiliados.
6. Admin em `/admin` -> lotacao das contas, cobrancas pendentes com desconto aplicado, aba Afiliados para ver quem indicou quem e marcar premios como entregues.

## Architecture

- Rotas com Wouter em `app.tsx`: `/`, `/login`, `/signup`, `/dashboard`, `/admin`.
- API em Hono + oRPC (`src/api/routes/*`), tipada ponta a ponta; queries do cliente com TanStack Query em `src/web/queries/*`.
- Middlewares em `api/middleware/auth.ts`: `base` (publico), `withUser`, `authed`, `adminOnly`.
- Banco: Turso/SQLite via Drizzle (`api/database/schema.ts`); migracoes com `bun run db:push`.
- Icones: `lucide-react` para UI; `react-icons/si` para as marcas dos streamings.
- Kit visual reutilizavel em `components/ui/kit.tsx`: `GlassCard`, `NeonButton`, `Pill`, `ProgressBar`, `SectionTitle`, `NeonBackdrop`, `accentHex`.

## Painel do cliente — acesso direto, guia, PWA e assistente

- Cada card de app tem duas acoes lado a lado: "Abrir <servico>" (solido vermelho, abre o
  site oficial em nova aba) e "Como acessar" (outline ciano, abre o guia). "Relatar
  problema" continua abaixo, separado por divisoria.
- Modal "Como acessar": glass forte, glow na cor da marca, header com o icone do app,
  passos numerados em circulos da cor da marca, bloco ciano de dicas e bloco ambar de
  regras de seguranca. No celular vira bottom sheet com scroll interno.
- Card "Instalar Aplicativo" em roxo, dispensavel, com roteiro alternativo para iOS.
- Assistente de IA: FAB ciano fixo (acima da nav mobile e do badge Runable) que abre um
  painel de chat ancorado no canto no desktop e bottom sheet no celular. Bolha do cliente
  em vermelho, do assistente em glass neutro. Sem emoji nas respostas: as fontes Sora/Outfit
  nao tem glifos de emoji.
- Icones do PWA: fundo `#09090b`, glow vermelho no topo e ciano na base, "P+" em Sora
  ExtraBold com contorno `#ff1f3d`.

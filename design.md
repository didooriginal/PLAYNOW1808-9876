# PLAPLUSNOW — Design

SaaS brasileiro de venda e gestão de pacotes de streaming compartilhados. Ships on **web** (Vite + React + Tailwind 4). Visual: dark-mode futurista/tech, glassmorphism intenso, luzes neon (vermelho elétrico, ciano, roxo). Job: converter visitante em assinante de combo de streamings e dar a ele/ao admin um painel de gestão dos acessos.

Escopo atual: **backend real** em Turso/SQLite + Drizzle. `pacotes`, `contas_matrizes` e `usuarios` vêm do banco (landing, painel do cliente e admin). Seguem em mock (`src/web/lib/mock-data.ts`): catálogo de serviços/ícones, depoimentos, stats, faturas, novidades/upgrades e série de MRR. Sem auth ainda.

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

- **Landing** (`src/web/pages/index.tsx`) — header, hero de economia, comparativo caro vs. combo, toggle Mensal/Anual + 3 pacotes prontos, montador à la carte com calculadora flutuante, prova social, footer.
- **Painel do Cliente** (`src/web/pages/dashboard.tsx`) — sidebar (Meus Acessos / Novidades e Upgrades / Faturas), pacote ativo, grade de cards de app com e-mail + ver/copiar senha.
- **Painel Admin** (`src/web/pages/admin.tsx`) — KPIs, gestão de estoque/contas matrizes com progress bar de lotação (vermelho + tag "Esgotado" em 5/5), lista de clientes e faturas.

## Key User Flows

1. Landing → escolhe ciclo (mensal/anual) → clica "Garantir Vaga" em um pacote → abre WhatsApp com mensagem pré-preenchida.
2. Landing → montador: seleciona apps na grade → calculadora flutuante soma em tempo real (desconto progressivo por quantidade) → "Finalizar via WhatsApp".
3. Cliente entra em `/dashboard` → vê pacote ativo → revela/copia senha de cada app.
4. Admin em `/admin` → vê lotação das contas matrizes → identifica contas esgotadas e faturas a vencer.

## Architecture

- Rotas com Wouter em `app.tsx`: `/`, `/dashboard`, `/admin`.
- Estado só no cliente (`useState`/`useMemo`), zero chamadas de API. Mocks tipados em `lib/mock-data.ts`.
- Ícones: `lucide-react` para UI; `react-icons/si` para as marcas dos streamings (lucide não tem logos de marca).
- Componentes compartilhados em `src/web/components/` (`logo`, `glass`, `site-header`, `app-icon`, `progress`).

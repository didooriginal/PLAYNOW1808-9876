import { useMemo, useState } from "react";
import {
  BookOpen,
  Boxes,
  Compass,
  Info,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, Pill, accentHex, accentText } from "../ui/kit";
import {
  MANUAL,
  MANUAL_VERSAO,
  type Bloco,
  type SecaoManual,
} from "@/lib/manual-admin";

const DIACRITICOS = new RegExp("[\u0300-\u036f]", "g");

const ICONES: Record<SecaoManual["icone"], LucideIcon> = {
  inicio: Compass,
  clientes: Users,
  estoque: Boxes,
  catalogo: Smartphone,
  codigos: KeyRound,
  gamificacao: Trophy,
  suporte: LifeBuoy,
  faturas: Receipt,
  regras: ShieldAlert,
};

const TOM = {
  regra: { icon: ShieldCheck, accent: "red" as const, rotulo: "Regra" },
  atencao: { icon: TriangleAlert, accent: "purple" as const, rotulo: "Atenção" },
  dica: { icon: Lightbulb, accent: "cyan" as const, rotulo: "Dica" },
};

/* ------------------------------------------------------------------ */

/** texto pesquisável de uma seção — usado no filtro da busca */
function textoDaSecao(s: SecaoManual) {
  const partes = [s.titulo, s.resumo, s.onde];
  for (const b of s.blocos) {
    if (b.tipo === "texto" || b.tipo === "aviso") partes.push(b.texto);
    if (b.tipo === "passos") partes.push(b.titulo ?? "", ...b.itens);
    if (b.tipo === "campos")
      partes.push(b.titulo ?? "", ...b.itens.flatMap((i) => [i.termo, i.desc]));
    if (b.tipo === "tabela")
      partes.push(b.titulo ?? "", ...b.colunas, ...b.linhas.flat());
  }
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase();
}

/* ------------------------------------------------------------------ */

function BlocoTitulo({ children }: { children: string }) {
  return (
    <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
      {children}
    </h4>
  );
}

function Passos({ itens }: { itens: string[] }) {
  return (
    <ol className="space-y-2.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] font-mono text-[10px] font-bold text-white/55">
            {i + 1}
          </span>
          <p className="font-sans text-[13px] leading-relaxed text-white/60">{item}</p>
        </li>
      ))}
    </ol>
  );
}

function Campos({ itens }: { itens: { termo: string; desc: string }[] }) {
  return (
    <dl className="grid gap-2.5 sm:grid-cols-2">
      {itens.map((item) => (
        <div
          key={item.termo}
          className="rounded-2xl border border-white/8 bg-white/[0.025] p-3.5"
        >
          <dt className="font-display text-[13px] font-bold text-white">{item.termo}</dt>
          <dd className="mt-1 font-sans text-[12.5px] leading-relaxed text-white/50">
            {item.desc}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[300px] border-collapse text-left">
        <thead>
          <tr className="bg-white/[0.04]">
            {colunas.map((c) => (
              <th
                key={c}
                className="px-3.5 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-t border-white/6">
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-3.5 py-2.5 align-top font-sans text-[12.5px] leading-relaxed",
                    j === 0 ? "font-semibold text-white/80" : "text-white/50",
                  )}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Aviso({ tom, texto }: { tom: keyof typeof TOM; texto: string }) {
  const cfg = TOM[tom];
  const Icon = cfg.icon;
  const hex = accentHex[cfg.accent];
  return (
    <div
      className="flex gap-3 rounded-2xl border p-3.5"
      style={{ borderColor: `${hex}40`, background: `${hex}0f` }}
    >
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color: hex }} />
      <p className="font-sans text-[12.5px] leading-relaxed text-white/65">
        <span className="font-display font-bold" style={{ color: hex }}>
          {cfg.rotulo}:{" "}
        </span>
        {texto}
      </p>
    </div>
  );
}

function RenderBloco({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "texto")
    return (
      <p className="font-sans text-[13.5px] leading-relaxed text-white/60">{bloco.texto}</p>
    );

  if (bloco.tipo === "aviso") return <Aviso tom={bloco.tom} texto={bloco.texto} />;

  return (
    <div className="space-y-3">
      {bloco.titulo && <BlocoTitulo>{bloco.titulo}</BlocoTitulo>}
      {bloco.tipo === "passos" && <Passos itens={bloco.itens} />}
      {bloco.tipo === "campos" && <Campos itens={bloco.itens} />}
      {bloco.tipo === "tabela" && <Tabela colunas={bloco.colunas} linhas={bloco.linhas} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Secao({ secao, indice }: { secao: SecaoManual; indice: number }) {
  const Icon = ICONES[secao.icone];
  const hex = accentHex[secao.accent];

  return (
    <GlassCard
      id={`manual-${secao.id}`}
      accent={secao.accent}
      className="scroll-mt-24 p-5 sm:p-7"
      data-testid={`manual-secao-${secao.id}`}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${hex}55`, background: `${hex}14`, color: hex }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-white/25">
              {String(indice).padStart(2, "0")}
            </span>
            <h3 className="min-w-0 font-display text-lg font-extrabold tracking-tight text-white">
              {secao.titulo}
            </h3>
          </div>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-white/45">
            {secao.resumo}
          </p>
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 font-sans text-[11px]",
              accentText[secao.accent],
            )}
          >
            <Info className="size-3" />
            {secao.onde}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5 border-t border-white/8 pt-5">
        {secao.blocos.map((bloco, i) => (
          <RenderBloco key={i} bloco={bloco} />
        ))}
      </div>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

function Indice({
  secoes,
  onIr,
}: {
  secoes: SecaoManual[];
  onIr: (id: string) => void;
}) {
  return (
    <GlassCard strong className="p-4 lg:sticky lg:top-6">
      <div className="flex items-center gap-2 px-1">
        <BookOpen className="size-3.5 text-neon-purple" />
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Tópicos
        </span>
      </div>
      <nav className="mt-3 space-y-1">
        {secoes.map((s, i) => {
          const Icon = ICONES[s.icone];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onIr(s.id)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="font-mono text-[10px] text-white/25">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon className={cn("size-3.5 shrink-0", accentText[s.accent])} />
              <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-white/60">
                {s.titulo}
              </span>
            </button>
          );
        })}
      </nav>
      <p className="mt-3 border-t border-white/8 px-1 pt-3 font-sans text-[10px] text-white/25">
        Manual operacional · versão {MANUAL_VERSAO}
      </p>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */

export function ManualView() {
  const [busca, setBusca] = useState("");

  const termo = busca
    .trim()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase();

  const indexado = useMemo(
    () => MANUAL.map((s) => ({ secao: s, texto: textoDaSecao(s) })),
    [],
  );

  const secoes = useMemo(
    () => (termo ? indexado.filter((i) => i.texto.includes(termo)) : indexado).map((i) => i.secao),
    [indexado, termo],
  );

  const irPara = (id: string) => {
    document
      .getElementById(`manual-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      <GlassCard strong accent="purple" className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Pill accent="purple" icon={<ShieldCheck className="size-3" />}>
              Documento interno
            </Pill>
            <h2 className="mt-3 font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Manual operacional da PLAPLUSNOW
            </h2>
            <p className="mt-2 max-w-2xl font-sans text-[13.5px] leading-relaxed text-white/50">
              Tudo o que o painel administrativo faz, tópico por tópico: como cadastrar e cobrar
              clientes, administrar contas matrizes e vagas, manter catálogo e combos, capturar
              códigos de verificação, operar a gamificação e atender a fila de suporte.
            </p>
          </div>
          <label className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no manual..."
              data-testid="manual-busca"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
            />
          </label>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-start">
        <div className="order-2 lg:order-1">
          <Indice secoes={MANUAL} onIr={irPara} />
        </div>

        <div className="order-1 space-y-5 lg:order-2">
          {secoes.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <Search className="mx-auto size-5 text-white/25" />
              <p className="mt-3 font-display text-sm font-bold text-white">
                Nada encontrado para “{busca.trim()}”
              </p>
              <p className="mt-1.5 font-sans text-xs text-white/40">
                Tente outro termo — por exemplo “vaga”, “OTP”, “cupom” ou “fatura”.
              </p>
            </GlassCard>
          ) : (
            secoes.map((s) => (
              <Secao key={s.id} secao={s} indice={MANUAL.findIndex((m) => m.id === s.id) + 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

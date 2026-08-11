import type { ComponentType } from "react";
import { SiCrunchyroll, SiSpotify, SiYoutube } from "react-icons/si";
import { cn } from "@/lib/utils";
import { serviceById, type ServiceId } from "@/lib/mock-data";

/**
 * ÍCONE DE APP.
 *
 * Prioridade de renderização:
 *  1. Logo OFICIAL do app (PNG quadrado em /images/apps/<slug>.png, baixado da
 *     App Store — mesma arte que o cliente vê na TV/celular). Preenche o tile.
 *  2. Glyph de marca monocromático (react-icons/si) para casos sem logo oficial.
 *  3. Sigla (`mono`) da cor da marca, para qualquer serviço ainda sem arte.
 *
 * IPTV e Futebol Ao Vivo usam logos PRÓPRIAS da PLAYPLUSNOW (não há marca de
 * terceiro), geradas na identidade da casa: neon sobre fundo quase preto.
 *
 * Para adicionar um logo novo: salve o PNG quadrado em
 * packages/web/public/images/apps/<slug>.png e inclua o slug em OFFICIAL_LOGOS.
 */

/** slugs com logo oficial em /images/apps/<slug>.png */
const OFFICIAL_LOGOS = new Set<string>([
  "netflix",
  "disney",
  "prime",
  "hbomax",
  "paramount",
  "appletv",
  "spotify",
  "youtube",
  "crunchyroll",
  "globoplay",
  "deezer",
  "canva",
  "looke",
  "recordplus",
  // logos próprias da PLAYPLUSNOW — serviços da casa, sem marca de terceiro
  "iptv",
  "jogos",
]);

/** fallback de marca monocromática quando não há PNG oficial */
const brandIcons: Partial<Record<ServiceId, ComponentType<{ className?: string }>>> = {
  spotify: SiSpotify,
  youtube: SiYoutube,
  crunchyroll: SiCrunchyroll,
};

const boxSizes = {
  xs: "size-8 rounded-lg text-[10px]",
  sm: "size-10 rounded-xl text-xs",
  md: "size-14 rounded-2xl text-sm",
  lg: "size-16 rounded-2xl text-base",
};

const glyphSizes = {
  xs: "size-4",
  sm: "size-5",
  md: "size-7",
  lg: "size-8",
};

export function AppIcon({
  id,
  size = "md",
  className,
  active = false,
}: {
  id: string;
  size?: keyof typeof boxSizes;
  className?: string;
  active?: boolean;
}) {
  const service = serviceById(id);
  const hasLogo = OFFICIAL_LOGOS.has(id);

  // 1) logo oficial — preenche o tile inteiro, sem tint por cima da marca
  if (hasLogo) {
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border bg-white/5 transition-all duration-300",
          boxSizes[size],
          className,
        )}
        style={{
          borderColor: active ? service.color : `${service.color}40`,
          boxShadow: active
            ? `0 0 22px -4px ${service.color}aa, inset 0 1px 0 rgba(255,255,255,0.14)`
            : `inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
        title={service.name}
      >
        <img
          src={`/images/apps/${id}.png`}
          alt={service.name}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          draggable={false}
        />
      </span>
    );
  }

  // 2/3) glyph de marca ou ícone genérico sobre o tile de vidro
  const Brand = brandIcons[id as ServiceId];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border transition-all duration-300",
        boxSizes[size],
        className,
      )}
      style={{
        background: `radial-gradient(120% 120% at 30% 0%, ${service.color}2e 0%, rgba(255,255,255,0.03) 70%)`,
        borderColor: active ? `${service.color}` : `${service.color}40`,
        boxShadow: active
          ? `0 0 22px -4px ${service.color}aa, inset 0 1px 0 rgba(255,255,255,0.14)`
          : `inset 0 1px 0 rgba(255,255,255,0.08)`,
        color: service.color,
      }}
      title={service.name}
    >
      {Brand ? (
        <Brand className={glyphSizes[size]} />
      ) : (
        <span className="font-display font-extrabold tracking-tight">{service.mono}</span>
      )}
    </span>
  );
}

export default AppIcon;

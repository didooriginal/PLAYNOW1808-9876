import type { ComponentType } from "react";
import {
  SiNetflix,
  SiHbomax,
  SiParamountplus,
  SiAppletv,
  SiSpotify,
  SiYoutube,
  SiCrunchyroll,
  SiCanva,
} from "react-icons/si";
import { cn } from "@/lib/utils";
import { serviceById, type ServiceId } from "@/lib/mock-data";

const brandIcons: Partial<Record<ServiceId, ComponentType<{ className?: string }>>> = {
  netflix: SiNetflix,
  hbomax: SiHbomax,
  paramount: SiParamountplus,
  appletv: SiAppletv,
  spotify: SiSpotify,
  youtube: SiYoutube,
  crunchyroll: SiCrunchyroll,
  canva: SiCanva,
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

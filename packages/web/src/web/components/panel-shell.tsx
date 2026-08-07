import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import type { Accent } from "@/lib/mock-data";
import { accentHex } from "./ui/kit";

export type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export function PanelShell({
  nav,
  active,
  onNavigate,
  accent,
  user,
  role,
  children,
}: {
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  accent: Accent;
  user: { name: string; email: string; initials: string };
  role: string;
  children: ReactNode;
}) {
  const hex = accentHex[accent];

  return (
    <div className="relative flex min-h-screen">
      {/* ---------------- sidebar (desktop) ---------------- */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-white/8 bg-white/[0.02] px-4 py-6 backdrop-blur-2xl lg:flex">
        <Link to="/" className="px-2">
          <Logo size="sm" withTagline={false} />
        </Link>

        <div
          className="mt-6 rounded-2xl border p-3"
          style={{ borderColor: `${hex}33`, background: `${hex}0f` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border font-display text-xs font-bold"
              style={{ borderColor: `${hex}55`, background: `${hex}1f`, color: hex }}
            >
              {user.initials}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold text-white">
                {user.name}
              </div>
              <div className="truncate font-sans text-[10px] uppercase tracking-widest" style={{ color: hex }}>
                {role}
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left font-sans text-sm transition-all",
                  isActive ? "text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80",
                )}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(90deg, ${hex}22 0%, transparent 100%)`,
                        boxShadow: `inset 1px 0 0 ${hex}`,
                      }
                    : undefined
                }
              >
                <item.icon
                  className="size-4 shrink-0"
                  style={isActive ? { color: hex } : undefined}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="rounded-full px-1.5 py-0.5 font-display text-[10px] font-bold"
                    style={{ background: `${hex}22`, color: hex }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 space-y-1 border-t border-white/8 pt-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-sm text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Voltar ao site
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-sm text-white/40 transition-colors hover:bg-neon-red/10 hover:text-neon-red"
          >
            <LogOut className="size-4" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ---------------- conteúdo ---------------- */}
      <div className="min-w-0 flex-1">
        {/* topbar mobile */}
        <div className="sticky top-0 z-40 border-b border-white/8 bg-background/80 px-4 py-3 backdrop-blur-2xl lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link to="/">
              <Logo size="sm" withTagline={false} />
            </Link>
            <span
              className="flex size-9 items-center justify-center rounded-xl border font-display text-[11px] font-bold"
              style={{ borderColor: `${hex}55`, background: `${hex}1f`, color: hex }}
            >
              {user.initials}
            </span>
          </div>
          <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {nav.map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 font-sans text-xs transition-all",
                    isActive ? "text-white" : "border-white/10 bg-white/[0.03] text-white/45",
                  )}
                  style={
                    isActive
                      ? { borderColor: `${hex}66`, background: `${hex}1a`, color: "#fff" }
                      : undefined
                  }
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="px-4 py-6 sm:px-7 sm:py-9">{children}</main>
      </div>
    </div>
  );
}

export default PanelShell;

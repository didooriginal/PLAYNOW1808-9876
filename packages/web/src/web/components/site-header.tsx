import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Menu, ShieldCheck, UserRound, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NeonButton } from "./ui/kit";

const nav = [
  { label: "Economia", href: "#economia" },
  { label: "Pacotes", href: "#pacotes" },
  { label: "Monte o seu", href: "#montador" },
  { label: "Depoimentos", href: "#depoimentos" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl px-4 py-3 transition-all duration-500 sm:px-6",
          scrolled ? "glass-strong shadow-2xl" : "glass",
        )}
      >
        <Link to="/" className="flex items-center gap-3">
          <Logo size="sm" withTagline={false} />
          <span className="hidden h-8 w-px bg-white/10 sm:block" />
          <span className="hidden font-sans text-[9px] uppercase tracking-[0.28em] text-white/35 sm:block">
            Entretenimento
            <br />
            de verdade
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 font-sans text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/admin"
            className="ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-sans text-xs text-white/30 transition-colors hover:text-neon-purple"
          >
            <ShieldCheck className="size-3.5" />
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="hidden sm:block">
            <NeonButton accent="cyan" variant="outline" size="sm">
              <UserRound className="size-4" />
              Área do Cliente
            </NeonButton>
          </Link>
          <Link to="/signup">
            <NeonButton accent="red" size="sm">
              <Zap className="size-4" />
              Assine agora!
            </NeonButton>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 lg:hidden"
            aria-label="Menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass-strong mx-auto mt-2 max-w-7xl rounded-2xl p-3 lg:hidden">
          <div className="flex flex-col">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-sans text-sm text-white/70 hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/dashboard"
              className="rounded-xl px-4 py-3 font-sans text-sm text-neon-cyan hover:bg-white/5"
            >
              Área do Cliente
            </Link>
            <Link
              to="/admin"
              className="rounded-xl px-4 py-3 font-sans text-sm text-neon-purple hover:bg-white/5"
            >
              Painel Admin
            </Link>
            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 font-sans text-sm font-semibold text-neon-red hover:bg-white/5"
            >
              Assine agora!
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;

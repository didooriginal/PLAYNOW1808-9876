import { Link } from "wouter";
import { MessageCircle, Send, ShieldCheck } from "lucide-react";
import { Logo } from "../logo";
import { GlassCard, NeonButton } from "../ui/kit";
import { whatsappLink } from "@/lib/mock-data";

export function CtaBand() {
  return (
    <section className="relative px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <GlassCard strong accent="red" className="relative overflow-hidden p-8 sm:p-12">
          <div
            className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(255,31,61,0.35) 0%, transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -right-16 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)" }}
          />
          <div className="relative flex flex-col items-center gap-8 text-center lg:flex-row lg:justify-between lg:text-left">
            <div>
              <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
                Sua fatura mais barata{" "}
                <span className="text-neon-red glow-red">que uma pizza</span>
              </h2>
              <p className="mt-3 max-w-xl font-sans text-white/50">
                Fale com um atendente agora, escolha seus apps e receba os acessos em minutos. Sem
                contrato, sem taxa de adesão.
              </p>
            </div>
            <a
              href={whatsappLink("Olá! Vi o site da PLAYPLUSNOW e quero assinar um combo de streamings.")}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
            >
              <NeonButton accent="red" size="lg">
                <MessageCircle className="size-5" />
                Falar no WhatsApp
              </NeonButton>
            </a>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 px-4 py-14 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Logo size="sm" />
          <p className="mt-5 max-w-xs font-sans text-xs leading-relaxed text-white/35">
            PLAYPLUSNOW é uma plataforma de gestão de pacotes de streaming compartilhados. Interface
            de demonstração com dados fictícios.
          </p>
          <div className="mt-5 flex gap-2">
            {[MessageCircle, Send].map((Icon, i) => (
              <span
                key={i}
                className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition-colors hover:border-neon-red/40 hover:text-neon-red"
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>

        {[
          {
            title: "Plataforma",
            links: [
              { label: "Pacotes prontos", href: "#pacotes" },
              { label: "Monte seu combo", href: "#montador" },
              { label: "Economia", href: "#economia" },
              { label: "Vantagens", href: "#features" },
              { label: "Perguntas (FAQ)", href: "#faq" },
            ],
          },
          {
            title: "Painéis",
            links: [
              { label: "Área do Cliente", href: "/dashboard", route: true },
              { label: "Painel Admin", href: "/admin", route: true },
            ],
          },
          {
            title: "Suporte",
            links: [
              { label: "Central de ajuda", href: "#" },
              { label: "Como instalar na TV", href: "#" },
              { label: "Termos de uso", href: "#" },
              { label: "Privacidade", href: "#" },
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              {col.title}
            </div>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {"route" in l && l.route ? (
                    <Link
                      to={l.href}
                      className="font-sans text-sm text-white/40 transition-colors hover:text-neon-cyan"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      className="font-sans text-sm text-white/40 transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/8 pt-6 sm:flex-row">
        <span className="font-sans text-[11px] text-white/25">
          © 2026 PLAYPLUSNOW · Todos os dados exibidos são fictícios
        </span>
        <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-white/25">
          <ShieldCheck className="size-3.5 text-neon-cyan" />
          Pagamentos via PIX e cartão · ambiente de demonstração
        </span>
      </div>
    </footer>
  );
}

export default Footer;

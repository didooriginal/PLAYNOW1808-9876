import {
  AppWindow,
  BadgeCheck,
  CreditCard,
  Gift,
  HelpCircle,
  Info,
  Shield,
  LifeBuoy,
  CreditCard as PaymentIcon,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import { GlassCard, SectionTitle } from "../ui/kit";
import { cn } from "../../lib/utils";

/**
 * SEÇÕES DE CONVERSÃO DA LANDING
 * ------------------------------------------------------------------
 * `Stats` (prova social em números), `Features` (por que assinar) e `Faq`
 * (dúvidas divididas por categoria, com âncoras internas). Só conteúdo
 * estático — nenhuma dessas seções depende da API.
 */

const features = [
  {
    icon: Zap,
    title: "Ativação Relâmpago",
    description:
      "Pagou no Pix? O acesso aparece no seu painel em até 10 minutos. Sem espera, sem burocracia.",
    accent: "red" as const,
  },
  {
    icon: ShieldCheck,
    title: "Garantia Anti-Queda",
    description:
      "Monitoramos as contas matrizes 24/7. Se um acesso cair, nosso sistema repõe na hora.",
    accent: "cyan" as const,
  },
  {
    icon: Smartphone,
    title: "Multidispositivos",
    description:
      "Assista na Smart TV, celular, tablet ou PC. A qualidade 4K HDR é garantida em todos.",
    accent: "purple" as const,
  },
  {
    icon: CreditCard,
    title: "Sem Fidelidade",
    description:
      "Você é dono da sua assinatura. Cancele, troque ou faça upgrade de plano quando quiser.",
    accent: "red" as const,
  },
];

const faqCategories = [
  {
    id: "geral",
    name: "Geral",
    icon: Info,
    questions: [
      {
        q: "Como recebo meus acessos?",
        a: "Assim que o Pix é confirmado, os dados de e-mail e senha de cada aplicativo são liberados instantaneamente na sua Área do Cliente aqui no site. Você também recebe uma notificação.",
      },
      {
        q: "É seguro assinar assim?",
        a: "Sim. Somos uma plataforma de gestão de grupos: você divide o custo de uma conta premium com outros usuários e garante o menor preço do mercado.",
      },
    ],
  },
  {
    id: "acesso",
    name: "Acesso e Telas",
    icon: Smartphone,
    questions: [
      {
        q: "Posso usar em mais de uma tela?",
        a: "Nossos planos padrão dão direito a 1 tela simultânea por aplicativo. No plano 15 em 1, liberamos 2 telas nos principais serviços.",
      },
      {
        q: "Em quais dispositivos posso assistir?",
        a: "Em qualquer dispositivo que suporte os aplicativos oficiais: Smart TVs, celulares (Android/iOS), tablets, PCs e TV Box.",
      },
    ],
  },
  {
    id: "termos",
    name: "Termos de Uso",
    icon: Shield,
    questions: [
      {
        q: "Quais são as regras de uso dos grupos?",
        a: "Ao assinar você concorda em: 1) não compartilhar seus dados com terceiros; 2) usar apenas os 2 aparelhos cadastrados; 3) assistir em 1 tela por vez em cada aplicativo; 4) usar somente o perfil indicado no seu painel. O descumprimento gera banimento sem reembolso.",
      },
    ],
  },
  {
    id: "pagamento",
    name: "Pagamentos e Renovação",
    icon: PaymentIcon,
    questions: [
      {
        q: "Quais as formas de pagamento?",
        a: "Aceitamos Pix para ativação imediata e cartão de crédito na plataforma, com baixa automática.",
      },
      {
        q: "Como renovo minha assinatura?",
        a: "A renovação é feita direto no seu painel. Avisamos você 3 dias antes do vencimento para que não perca o acesso.",
      },
    ],
  },
  {
    id: "suporte",
    name: "Suporte e Garantia",
    icon: LifeBuoy,
    questions: [
      {
        q: "O que é a Garantia Anti-Queda?",
        a: "Se por qualquer motivo um acesso parar de funcionar, nosso sistema detecta ou você nos avisa, e trocamos a conta em minutos sem custo adicional.",
      },
      {
        q: "Como entro em contato com o suporte?",
        a: "Temos suporte via WhatsApp 24/7 e chat interno no painel do cliente.",
      },
    ],
  },
];

export function Features() {
  return (
    <section id="features" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Por que escolher a PLAYPLUSNOW?"
          accent="red"
          title={
            <>
              A melhor experiência de <span className="text-neon-red glow-red">streaming</span> do
              Brasil
            </>
          }
          subtitle="Unimos tecnologia e economia para que você nunca mais precise escolher qual assinatura cancelar no fim do mês."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <GlassCard
              key={f.title}
              accent={f.accent}
              hover
              className="animate-rise p-6 text-center sm:text-left"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={cn(
                  "mb-5 inline-flex size-12 items-center justify-center rounded-2xl border bg-white/[0.03]",
                  f.accent === "red"
                    ? "border-neon-red/30 text-neon-red"
                    : f.accent === "cyan"
                      ? "border-neon-cyan/30 text-neon-cyan"
                      : "border-neon-purple/30 text-neon-purple",
                )}
              >
                <f.icon className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-white/45">{f.description}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-96 blur-[120px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 100%, rgba(168,85,247,0.1) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-5xl">
        <SectionTitle
          eyebrow="Dúvidas frequentes"
          accent="purple"
          title="Perguntas e respostas"
          subtitle="Tudo o que você precisa saber para começar a economizar hoje mesmo."
        />

        {/* atalhos por categoria */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {faqCategories.map((cat) => (
            <a
              key={cat.id}
              href={`#faq-${cat.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:border-neon-purple/50 hover:bg-neon-purple/10 hover:text-white"
            >
              <cat.icon className="size-3.5" />
              {cat.name}
            </a>
          ))}
        </div>

        <div className="mt-16 space-y-12">
          {faqCategories.map((category) => (
            <div key={category.id} id={`faq-${category.id}`} className="scroll-mt-24">
              <div className="mb-6 flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-neon-purple/10 text-neon-purple">
                  <category.icon className="size-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">{category.name}</h3>
              </div>

              <div className="grid gap-4">
                {category.questions.map((item, i) => (
                  <GlassCard
                    key={`${category.id}-${i}`}
                    className="overflow-hidden ring-1 ring-neon-purple/10"
                  >
                    <div className="p-5">
                      <h4 className="flex items-start gap-3 font-display text-base font-bold text-white">
                        <HelpCircle className="mt-0.5 size-5 shrink-0 text-neon-purple" />
                        {item.q}
                      </h4>

                      <div className="mt-4 border-t border-white/5 pt-4">
                        <p className="font-sans text-sm leading-relaxed text-white/50">{item.a}</p>
                        {category.id === "pagamento" && (
                          <div className="mt-4 flex gap-4">
                            <a
                              href="#pacotes"
                              className="text-xs font-bold text-neon-purple hover:underline"
                            >
                              Ver pacotes →
                            </a>
                          </div>
                        )}
                        {category.id === "suporte" && (
                          <div className="mt-4 flex gap-4">
                            <a
                              href="#contato"
                              className="text-xs font-bold text-neon-purple hover:underline"
                            >
                              Falar com suporte →
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Stats() {
  const items = [
    { label: "Assinaturas Ativas", value: "5.432", icon: Users, accent: "red" as const },
    { label: "Economia Gerada", value: "R$ 1.2M+", icon: Gift, accent: "cyan" as const },
    { label: "Apps Disponíveis", value: "20+", icon: AppWindow, accent: "purple" as const },
    { label: "Suporte 24/7", value: "100%", icon: BadgeCheck, accent: "red" as const },
  ];

  return (
    <section className="relative px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.04]"
            >
              <div className="relative z-10">
                <item.icon
                  className={cn(
                    "mb-4 size-6",
                    item.accent === "red"
                      ? "text-neon-red"
                      : item.accent === "cyan"
                        ? "text-neon-cyan"
                        : "text-neon-purple",
                  )}
                />
                <div className="font-display text-3xl font-black text-white">{item.value}</div>
                <div className="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-white/30">
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

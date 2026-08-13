import { PlayCircle, BookOpen, Smartphone, ShieldCheck, AlertCircle, ArrowLeft } from "lucide-react";
import { GlassCard, NeonButton, SectionTitle, NeonBackdrop } from "../components/ui/kit";
import { Logo } from "../components/logo";
import { Link } from "wouter";

import { whatsappLink } from "../lib/mock-data";

const TUTORIAIS = [
  {
    id: "instalar-tv",
    titulo: "Como instalar na Smart TV",
    video: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Exemplo, Diego deve trocar pelos reais
    desc: "Passo a passo completo para configurar seu acesso direto na TV (Samsung, LG, Android TV).",
  },
  {
    id: "bloqueio-netflix",
    titulo: "Resolvendo Bloqueio de Residência",
    video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    desc: "Aprenda como pegar o código de confirmação direto pelo nosso painel em segundos.",
  },
  {
    id: "configurar-iptv",
    titulo: "Configuração de IPTV / TV Box",
    video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    desc: "Como baixar e ativar o aplicativo na sua TV Box ou Fire Stick.",
  }
];

function TutoriaisPage() {
  return (
    <div className="relative min-h-screen bg-[#050507] pb-20 pt-24">
      <NeonBackdrop />
      
      <div className="container relative mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <Link href="/">
            <NeonButton size="sm" variant="outline" accent="cyan" className="gap-2">
              <ArrowLeft className="size-4" />
              Voltar para o início
            </NeonButton>
          </Link>
        </div>
        <div className="mb-12 text-center">

          <Logo size="sm" className="mx-auto mb-8" />
          <SectionTitle
            eyebrow="Central de Ajuda"
            title={<>Tutorial</>}
            subaria-label="Tudo o que você precisa saber para configurar seus acessos e aproveitar o melhor do streaming."
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TUTORIAIS.map((t) => (
            <GlassCard key={t.id} accent="cyan" className="overflow-hidden">
              <div className="aspect-video w-full bg-black/40">
                <iframe
                  src={t.video}
                  className="size-full"
                  title={t.titulo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-5">
                <h3 className="font-display text-base font-bold text-white">{t.titulo}</h3>
                <p className="mt-2 font-sans text-xs leading-relaxed text-white/45">{t.desc}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <GlassCard strong accent="purple" className="p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 text-neon-purple" />
              <h3 className="font-display text-lg font-bold text-white">Regras de Uso</h3>
            </div>
            <ul className="mt-4 space-y-3">
              {[
                "Limite de 2 aparelhos cadastrados por assinatura.",
                "Uso de apenas 1 tela simultânea por aplicativo.",
                "Proibido compartilhar dados com terceiros.",
                "Use apenas o perfil designado no seu painel."
              ].map((r, i) => (
                <li key={i} className="flex gap-2 font-sans text-xs text-white/60">
                  <span className="text-neon-purple">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard strong accent="red" className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center gap-3">
                <AlertCircle className="size-6 text-neon-red" />
                <h3 className="font-display text-lg font-bold text-white">Ainda com dúvidas?</h3>
              </div>
              <p className="mt-3 font-sans text-xs leading-relaxed text-white/50">
                Nosso suporte está disponível 24h para te ajudar com qualquer dificuldade técnica ou de acesso.
              </p>
            </div>
            <a 
              href={whatsappLink("Olá! Preciso de ajuda com a configuração do meu app.")}
              target="_blank"
              rel="noreferrer"
              className="mt-6"
            >
              <NeonButton accent="red" className="w-full">
                Chamar no WhatsApp
              </NeonButton>
            </a>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}


export default TutoriaisPage;

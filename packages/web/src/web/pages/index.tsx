import { SiteHeader } from "../components/site-header";
import { Hero } from "../components/landing/hero";
import { Savings } from "../components/landing/savings";
import { Plans } from "../components/landing/plans";
import { Combos } from "../components/landing/combos";
import { Builder } from "../components/landing/builder";
import { SocialProof } from "../components/landing/social-proof";
import { CtaBand, Footer } from "../components/landing/footer";
import { AssistenteVisitanteLazy } from "../components/landing/assistente-visitante-lazy";
import { WhatsappFlutuante } from "../components/landing/whatsapp-flutuante";
import { NeonBackdrop } from "../components/ui/kit";
import { Faq, Features, Stats } from "../components/landing/new-sections";

function Index() {
  return (
    <div className="relative min-h-screen">
      <NeonBackdrop />
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <Hero />
        <Savings />
        <Stats />
        <Features />
        <Plans />
        <Combos />
        <Builder />
        <SocialProof />
        <Faq />
        <CtaBand />
      </main>
      <Footer />

      {/* flutuantes arrastaveis: robo de pre-venda + tag do WhatsApp */}
      <AssistenteVisitanteLazy />
      <WhatsappFlutuante />
    </div>
  );
}

export default Index;

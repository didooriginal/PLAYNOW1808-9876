import { SiteHeader } from "../components/site-header";
import { Hero } from "../components/landing/hero";
import { Savings } from "../components/landing/savings";
import { Plans } from "../components/landing/plans";
import { Builder } from "../components/landing/builder";
import { SocialProof } from "../components/landing/social-proof";
import { CtaBand, Footer } from "../components/landing/footer";
import { NeonBackdrop } from "../components/ui/kit";

function Index() {
  return (
    <div className="relative min-h-screen">
      <NeonBackdrop />
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <Hero />
        <Savings />
        <Plans />
        <Builder />
        <SocialProof />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}

export default Index;

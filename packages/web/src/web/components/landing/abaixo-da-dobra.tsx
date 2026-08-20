import { useEffect } from "react";
import { Savings } from "./savings";
import { Plans } from "./plans";
import { Combos } from "./combos";
import { Builder } from "./builder";
import { SocialProof } from "./social-proof";
import { CtaBand, Footer } from "./footer";
import { Faq, Features, Stats } from "./new-sections";

/**
 * Tudo o que fica abaixo da primeira dobra da landing.
 * Fica em um arquivo separado de proposito: a index.tsx importa este componente
 * com lazy(), entao esse codigo sai do bundle inicial e o celular pinta o Hero
 * antes de baixar o resto da pagina.
 */
function AbaixoDaDobra() {
  // se o usuario clicou em um link de ancora (#planos, #faq...) antes deste
  // chunk existir, o navegador nao achou o alvo. Agora que existe, rolamos.
  useEffect(() => {
    const alvo = window.location.hash.slice(1);
    if (!alvo) return;
    const el = document.getElementById(alvo);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <Savings />
      <Stats />
      <Features />
      <Plans />
      <Combos />
      <Builder />
      <SocialProof />
      <Faq />
      <CtaBand />
    </>
  );
}

export default AbaixoDaDobra;

/** Rodape, no mesmo chunk do resto do conteudo abaixo da dobra. */
export function Rodape() {
  return <Footer />;
}

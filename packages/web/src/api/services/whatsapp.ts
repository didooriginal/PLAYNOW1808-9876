/**
 * WHATSAPP DO ADMIN — via CallMeBot
 * ------------------------------------------------------------------
 * Por que CallMeBot e nao Twilio/Meta Cloud API:
 *   - a mensagem vai para NOS (equipe), nunca para o cliente. Nao existe
 *     exigencia de template aprovado nem de janela de 24h;
 *   - volume baixissimo (alguns alertas por dia);
 *   - e uma chamada GET simples, sem SDK, sem VPS e sem custo.
 * Se um dia precisarmos falar com o CLIENTE pelo WhatsApp, ai sim o caminho
 * certo passa a ser a Meta Cloud API (oficial, com template aprovado).
 *
 * CONFIGURACAO (.env da raiz):
 *   WHATSAPP_DESTINOS="5521995777108:123456,5511999999999:654321"
 * Formato de cada item: <telefone com DDI, so digitos>:<apikey do CallMeBot>.
 * A apikey e individual: cada numero precisa mandar uma vez
 * "I allow callmebot to send me messages" para +34 644 51 95 23 e o bot
 * responde com a chave daquele numero.
 *
 * Regra de ouro: falha de rede aqui NUNCA derruba o fluxo que chamou. O alerta
 * continua no painel do admin de qualquer forma.
 */

const ENDPOINT = "https://api.callmebot.com/whatsapp.php";

type Destino = { telefone: string; apikey: string };

/** le e valida `WHATSAPP_DESTINOS` — itens malformados sao ignorados em silencio */
export function destinosWhatsapp(): Destino[] {
  const bruto = process.env.WHATSAPP_DESTINOS || "";
  return bruto
    .split(",")
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => {
      const [telefone, apikey] = par.split(":").map((p) => p?.trim() ?? "");
      return { telefone: (telefone || "").replace(/\D/g, ""), apikey: apikey || "" };
    })
    .filter((d) => d.telefone.length >= 10 && d.apikey.length > 0);
}

/** true quando existe pelo menos um numero configurado */
export function whatsappConfigurado() {
  return destinosWhatsapp().length > 0;
}

/**
 * Manda a mesma mensagem para todos os numeros configurados.
 * Devolve quantos foram entregues — usado nos testes e no painel de saude.
 */
export async function enviarWhatsapp(mensagem: string) {
  const destinos = destinosWhatsapp();
  if (!destinos.length) return { enviados: 0, falhas: 0, configurado: false as const };

  const texto = mensagem.slice(0, 900);
  let enviados = 0;
  let falhas = 0;

  for (const destino of destinos) {
    try {
      const url = `${ENDPOINT}?phone=${encodeURIComponent(destino.telefone)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(destino.apikey)}`;
      const resposta = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15_000) });
      if (resposta.ok) enviados += 1;
      else {
        falhas += 1;
        // nunca logar a apikey: so o final do telefone e o status
        console.error(
          `[WhatsApp] falha para ...${destino.telefone.slice(-4)}: HTTP ${resposta.status}`,
        );
      }
    } catch (e) {
      falhas += 1;
      console.error(`[WhatsApp] erro de rede para ...${destino.telefone.slice(-4)}:`, e);
    }
  }

  return { enviados, falhas, configurado: true as const };
}

/** dispara sem esperar e sem nunca lancar — para usar dentro de mutations */
export function enviarWhatsappSeguro(mensagem: string) {
  void enviarWhatsapp(mensagem).catch(() => {});
}

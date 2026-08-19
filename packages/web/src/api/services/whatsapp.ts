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
 * "I allow callmebot to send me messages" para o bot do CallMeBot e o bot
 * responde com a chave daquele numero.
 *
 * ATENCAO: o numero do BOT muda de destino para destino (o CallMeBot tem
 * varios). Cada destino so recebe pelo bot que respondeu a apikey dele:
 *   21 99577-7108 -> bot +34 694 25 79 52
 *   21 96472-7746 -> o bot que respondeu naquele aparelho
 * Se um destino para de receber, o contato a desbloquear/desarquivar e o bot
 * DELE. O mapa fica em docs/whatsapp-alertas.md.
 *
 * Grupo de WhatsApp nao e possivel aqui: o FAQ do CallMeBot diz que so da para
 * enviar a contatos (grupo existe apenas no Telegram deles).
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
/**
 * LIMITE DO CALLMEBOT (importante): cada numero aceita cerca de 16 mensagens
 * por 240 minutos, e chamadas em rajada voltam 403 Forbidden. Quando isso
 * acontece a mensagem simplesmente NAO chega — era essa a causa dos alertas
 * "que nao chegam direito". Por isso aqui existem:
 *   - espera entre os destinos (o bot rejeita disparos simultaneos);
 *   - 3 tentativas com recuo progressivo em 403 / erro de rede;
 *   - deteccao explicita de limite atingido no log, para a equipe saber que a
 *     culpa e da cota e nao do codigo.
 */
const TENTATIVAS = 3;
const ESPERA_ENTRE_DESTINOS = 1500;

function dormir(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function limparCorpo(corpo: string) {
  return corpo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type ResultadoEnvio = {
  ok: boolean;
  /** motivo curto quando falhou, para log e para o painel de saude */
  motivo: string;
  /** true quando a cota do CallMeBot foi atingida */
  limite: boolean;
};

/** Um destino, com retentativas. Nunca lanca. */
async function enviarPara(destino: Destino, texto: string): Promise<ResultadoEnvio> {
  let ultimo = "sem resposta";
  let limite = false;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    try {
      const url = `${ENDPOINT}?phone=${encodeURIComponent(destino.telefone)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(destino.apikey)}`;
      const resposta = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20_000) });
      const corpo = limparCorpo(await resposta.text().catch(() => ""));

      /**
       * ATENCAO: o CallMeBot NAO usa o status HTTP de forma confiavel — apikey
       * invalida volta 203 e aceite volta 210. A unica confirmacao real de que
       * a mensagem entrou na fila e a palavra "queued" no corpo.
       */
      if (/queued/i.test(corpo)) return { ok: true, motivo: "", limite: false };

      if (/apikey is invalid/i.test(corpo)) {
        // chave errada nunca melhora com retentativa
        return { ok: false, motivo: "apikey invalida para este numero", limite: false };
      }

      if (/limit|too many|exceeded/i.test(corpo)) {
        limite = true;
        ultimo = "cota do CallMeBot atingida (16 msgs / 4h por numero)";
        break;
      }

      ultimo = `HTTP ${resposta.status} - ${corpo.slice(0, 140) || "corpo vazio"}`;
    } catch (e) {
      ultimo = `erro de rede: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (tentativa < TENTATIVAS) await dormir(tentativa * 2500);
  }

  return { ok: false, motivo: ultimo, limite };
}

/**
 * Manda a mesma mensagem para todos os numeros configurados.
 * Devolve quantos foram entregues — usado nos testes e no painel de saude.
 */
export async function enviarWhatsapp(mensagem: string) {
  const destinos = destinosWhatsapp();
  if (!destinos.length) return { enviados: 0, falhas: 0, configurado: false as const, limite: false };

  const texto = mensagem.slice(0, 900);
  let enviados = 0;
  let falhas = 0;
  let limite = false;

  for (const [i, destino] of destinos.entries()) {
    if (i > 0) await dormir(ESPERA_ENTRE_DESTINOS);
    const r = await enviarPara(destino, texto);
    if (r.ok) {
      enviados += 1;
    } else {
      falhas += 1;
      if (r.limite) limite = true;
      // nunca logar a apikey: so o final do telefone e o motivo
      console.error(`[WhatsApp] falha para ...${destino.telefone.slice(-4)}: ${r.motivo}`);
    }
  }

  return { enviados, falhas, configurado: true as const, limite };
}

/** dispara sem esperar e sem nunca lancar — para usar dentro de mutations */
export function enviarWhatsappSeguro(mensagem: string) {
  void enviarWhatsapp(mensagem).catch(() => {});
}

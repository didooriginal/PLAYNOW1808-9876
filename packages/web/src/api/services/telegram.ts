/**
 * TELEGRAM DO ADMIN - via CallMeBot
 * ------------------------------------------------------------------
 * Existe porque o WhatsApp do CallMeBot e instavel: a API aceita a mensagem
 * ("queued") e o bot as vezes simplesmente nao entrega. O Telegram do mesmo
 * CallMeBot e bem mais confiavel, e gratuito e - diferente do WhatsApp -
 * ACEITA GRUPO, entao a equipe toda ve o mesmo alerta.
 *
 * Dois modos, os dois opcionais e combinaveis:
 *
 * 1) GRUPO (recomendado) - .env: TELEGRAM_GRUPO_APIKEY="chave1,chave2"
 *    Endpoint: https://api.callmebot.com/telegram/group.php?apikey=...&text=...
 *    Como obter a chave:
 *      a) autorize o bot: mande /start para @CallMeBot_txtbot
 *      b) crie um grupo no Telegram
 *      c) adicione @API_CallMeBot nesse grupo
 *      d) em callmebot.com/blog/telegram-group-messages-api-easy/ informe seu
 *         usuario do Telegram e clique "Get ApiKey"
 *
 * 2) PESSOAL - .env: TELEGRAM_DESTINOS="@usuario1,@usuario2"
 *    Endpoint: https://api.callmebot.com/text.php?user=@usuario&text=...
 *    Cada usuario precisa mandar /start para @CallMeBot_txtbot uma vez.
 *
 * Regra de ouro (igual ao WhatsApp): falha aqui NUNCA derruba o fluxo que
 * chamou. O alerta continua no painel do admin de qualquer forma.
 */

const ENDPOINT_PESSOAL = "https://api.callmebot.com/text.php";
const ENDPOINT_GRUPO = "https://api.callmebot.com/telegram/group.php";
const TENTATIVAS = 3;
const ESPERA_ENTRE_DESTINOS = 1200;

function dormir(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function limparCorpo(corpo: string) {
  return corpo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function listaEnv(nome: string) {
  return (process.env[nome] || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** usuarios pessoais configurados, sempre com @ na frente */
export function usuariosTelegram() {
  return listaEnv("TELEGRAM_DESTINOS").map((u) => (u.startsWith("@") ? u : `@${u}`));
}

/** apikeys de grupo configuradas */
export function gruposTelegram() {
  return listaEnv("TELEGRAM_GRUPO_APIKEY");
}

export function telegramConfigurado() {
  return usuariosTelegram().length > 0 || gruposTelegram().length > 0;
}

type Alvo =
  | { tipo: "grupo"; apikey: string }
  | { tipo: "pessoal"; usuario: string };

function rotulo(alvo: Alvo) {
  // nunca logar a apikey inteira
  return alvo.tipo === "grupo" ? `grupo ...${alvo.apikey.slice(-3)}` : alvo.usuario;
}

function urlDe(alvo: Alvo, texto: string) {
  const t = encodeURIComponent(texto);
  return alvo.tipo === "grupo"
    ? `${ENDPOINT_GRUPO}?apikey=${encodeURIComponent(alvo.apikey)}&text=${t}&html=no`
    : `${ENDPOINT_PESSOAL}?user=${encodeURIComponent(alvo.usuario)}&text=${t}&html=no&links=no`;
}

async function enviarPara(alvo: Alvo, texto: string) {
  let ultimo = "sem resposta";

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    try {
      const resposta = await fetch(urlDe(alvo, texto), {
        method: "GET",
        signal: AbortSignal.timeout(20_000),
      });
      const corpo = limparCorpo(await resposta.text().catch(() => ""));

      // o CallMeBot responde "Message queued" / "message sent" quando aceita
      if (/queued|message sent|sent to/i.test(corpo) || (resposta.ok && !corpo)) {
        return { ok: true as const, motivo: "" };
      }
      if (/not authorized|authoriz|apikey is invalid|invalid apikey/i.test(corpo)) {
        // autorizacao errada nunca melhora com retentativa
        return {
          ok: false as const,
          motivo: "destino nao autorizou o bot (mande /start para @CallMeBot_txtbot)",
        };
      }
      ultimo = `HTTP ${resposta.status} - ${corpo.slice(0, 140) || "corpo vazio"}`;
    } catch (e) {
      ultimo = `erro de rede: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (tentativa < TENTATIVAS) await dormir(tentativa * 2000);
  }

  return { ok: false as const, motivo: ultimo };
}

/** Manda a mesma mensagem para todos os grupos e usuarios configurados. */
export async function enviarTelegram(mensagem: string) {
  const alvos: Alvo[] = [
    ...gruposTelegram().map((apikey) => ({ tipo: "grupo" as const, apikey })),
    ...usuariosTelegram().map((usuario) => ({ tipo: "pessoal" as const, usuario })),
  ];
  if (!alvos.length) {
    return { enviados: 0, falhas: 0, configurado: false as const, detalhes: [] as string[] };
  }

  const texto = mensagem.slice(0, 3500);
  let enviados = 0;
  let falhas = 0;
  const detalhes: string[] = [];

  for (const [i, alvo] of alvos.entries()) {
    if (i > 0) await dormir(ESPERA_ENTRE_DESTINOS);
    const r = await enviarPara(alvo, texto);
    if (r.ok) {
      enviados += 1;
      detalhes.push(`${rotulo(alvo)}: ok`);
    } else {
      falhas += 1;
      detalhes.push(`${rotulo(alvo)}: ${r.motivo}`);
      console.error(`[Telegram] falha para ${rotulo(alvo)}: ${r.motivo}`);
    }
  }

  return { enviados, falhas, configurado: true as const, detalhes };
}

/** dispara sem esperar e sem nunca lancar - para usar dentro de mutations */
export function enviarTelegramSeguro(mensagem: string) {
  void enviarTelegram(mensagem).catch(() => {});
}

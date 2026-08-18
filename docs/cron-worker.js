/**
 * PLAYPLUSNOW — Cloudflare Cron Worker
 * Dispara a varredura diária de cobrança por e-mail.
 *
 * O QUE ELE FAZ
 *   Uma vez por dia, faz GET em https://playplusnow.com.br/api/cron/vencimento
 *   com o header `Authorization: Bearer <CRON_SECRET>`. O servidor então envia:
 *     - aviso de vencimento (3 a 1 dia antes)
 *     - cobrança de fatura atrasada (marcos +1, +3 e +7 dias)
 *   A deduplicação é feita no servidor: chamar duas vezes não manda e-mail
 *   repetido, então rodar de novo é sempre seguro.
 *
 * PASSOS NO CLOUDFLARE (leva ~3 minutos)
 *   1. Painel → Workers & Pages → Create → Worker → nome: playplusnow-cron
 *   2. Deploy (ele cria um "hello world") → Edit code → apague tudo e cole
 *      este arquivo → Deploy.
 *   3. Settings → Variables and Secrets → Add:
 *        CRON_URL     (Text)   = https://playplusnow.com.br/api/cron/vencimento
 *        CRON_SECRET  (Secret) = o MESMO valor de CRON_SECRET no .env do servidor
 *      (opcional, para receber o resultado por e-mail)
 *        ALERTA_URL   (Text)   = deixe vazio se não quiser
 *   4. Settings → Trigger Events → Cron Triggers → Add Cron Trigger:
 *        0 12 * * *      → todo dia às 09:00 de Brasília (o cron do CF é UTC)
 *      Salve.
 *   5. Teste sem esperar o dia seguinte: aba "Deploy"/"Playground" ou abra a
 *      URL do worker no navegador (a rota GET / abaixo executa a mesma coisa).
 *
 * CUSTO: zero. Cron Triggers entram no plano gratuito do Workers.
 */

async function executar(env) {
  const url = env.CRON_URL || "https://playplusnow.com.br/api/cron/vencimento";
  const inicio = Date.now();

  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        "User-Agent": "playplusnow-cron-worker",
      },
    });

    const corpo = await resposta.text();
    const registro = {
      ok: resposta.ok,
      status: resposta.status,
      ms: Date.now() - inicio,
      resposta: corpo.slice(0, 500),
    };

    // aparece em Workers → Logs (Real-time logs)
    console.log("[cron]", JSON.stringify(registro));
    return registro;
  } catch (erro) {
    const registro = {
      ok: false,
      status: 0,
      ms: Date.now() - inicio,
      resposta: String(erro),
    };
    console.error("[cron] falhou:", JSON.stringify(registro));
    return registro;
  }
}

export default {
  /** disparo automático do Cron Trigger */
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(executar(env));
  },

  /** disparo manual: abra a URL do worker no navegador para testar agora */
  async fetch(_req, env) {
    const resultado = await executar(env);
    return new Response(JSON.stringify(resultado, null, 2), {
      status: resultado.ok ? 200 : 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};

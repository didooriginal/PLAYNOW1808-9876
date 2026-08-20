// PUSH WEB — lado do navegador.
//
// Passos, na ordem: service worker registrado → permissão concedida →
// inscrição criada com a chave VAPID → endpoint mandado para o servidor.
//
// No iPhone só funciona com o PWA instalado na tela de início; a UI avisa
// antes de pedir permissão para o cliente não achar que quebrou.

/** Converte a chave VAPID base64url para o Uint8Array que a API exige. */
function chaveParaBytes(base64url: string) {
  const preenchimento = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = window.atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export function pushSuportado() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissaoAtual(): NotificationPermission | "indisponivel" {
  if (!pushSuportado()) return "indisponivel";
  return Notification.permission;
}

function chavesDaInscricao(sub: PushSubscription) {
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  return { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export type DadosInscricao = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

/** Inscrição já existente neste navegador, se houver. */
export async function inscricaoAtual(): Promise<DadosInscricao | null> {
  if (!pushSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const { p256dh, auth } = chavesDaInscricao(sub);
  return { endpoint: sub.endpoint, p256dh, auth, userAgent: navigator.userAgent };
}

/**
 * Pede permissão e cria a inscrição. Devolve os dados que o servidor grava,
 * ou uma falha com o motivo em pt-BR para mostrar na tela.
 */
export async function criarInscricao(
  chavePublica: string,
): Promise<{ ok: true; dados: DadosInscricao } | { ok: false; motivo: string }> {
  if (!pushSuportado()) {
    return { ok: false, motivo: "Este navegador não suporta notificações." };
  }
  if (!chavePublica) {
    return { ok: false, motivo: "Notificações ainda não configuradas no servidor." };
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return { ok: false, motivo: "Permissão negada. Libere as notificações nas configurações do navegador." };
  }

  const reg = await navigator.serviceWorker.ready;
  const existente = await reg.pushManager.getSubscription();
  const sub =
    existente ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(chavePublica),
    }));

  const { p256dh, auth } = chavesDaInscricao(sub);
  if (!p256dh || !auth) return { ok: false, motivo: "Não foi possível criar a inscrição." };

  return {
    ok: true,
    dados: { endpoint: sub.endpoint, p256dh, auth, userAgent: navigator.userAgent },
  };
}

/** Cancela a inscrição no navegador. Devolve o endpoint removido. */
export async function cancelarInscricao(): Promise<string | null> {
  if (!pushSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  return endpoint;
}

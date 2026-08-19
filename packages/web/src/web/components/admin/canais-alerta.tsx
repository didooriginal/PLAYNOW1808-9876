// CANAIS DE ALERTA - onde os avisos do painel saem para fora (WhatsApp,
// Telegram e e-mail) e botao para testar os tres de uma vez.
import { CheckCircle2, Loader2, Mail, MessageCircle, Send, XCircle } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda } from "../ui/tooltip";
import { useCanaisAlerta, useTestarCanais } from "../../queries/notificacoes";

const ICONE_CANAL = {
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
} as const;

const ROTULO_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "E-mail",
};

export function CanaisAlertaCard() {
  const canais = useCanaisAlerta();
  const testar = useTestarCanais();
  const resultados = testar.data?.resultados ?? [];

  const lista = [
    {
      id: "whatsapp" as const,
      ligado: Boolean(canais.data?.whatsapp),
      nota: canais.data?.whatsapp
        ? "Números configurados. Entrega depende do bot do CallMeBot."
        : "Sem WHATSAPP_DESTINOS no .env.",
      ajuda: "canais.whatsapp",
    },
    {
      id: "telegram" as const,
      ligado: Boolean(canais.data?.telegram),
      nota: canais.data?.telegram
        ? canais.data?.telegramGrupo
          ? "Grupo do Telegram ativo — a equipe toda recebe."
          : "Usuários pessoais configurados."
        : "Sem TELEGRAM_GRUPO_APIKEY / TELEGRAM_DESTINOS no .env.",
      ajuda: "canais.telegram",
    },
    {
      id: "email" as const,
      ligado: Boolean(canais.data?.email),
      nota: canais.data?.email
        ? `Resend ativo · nível: ${canais.data?.nivelEmail ?? "critico"}`
        : "Sem RESEND_API_KEY no .env.",
      ajuda: "canais.email",
    },
  ];

  return (
    <GlassCard className="p-5" data-testid="canais-alerta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
            Canais de alerta
            <Ajuda ajuda="canais.card" />
          </div>
          <p className="mt-1 font-sans text-[13px] text-white/50">
            Todo alerta crítico sai por aqui, além de aparecer nesta fila.
          </p>
        </div>
        <NeonButton
          accent="cyan"
          size="sm"
          variant="outline"
          data-testid="testar-canais"
          disabled={testar.isPending}
          onClick={() => testar.mutate({})}
        >
          {testar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Testar todos os canais
        </NeonButton>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {lista.map((c) => {
          const Icone = ICONE_CANAL[c.id];
          const teste = resultados.find((r) => r.canal === c.id);
          return (
            <div
              key={c.id}
              data-testid={`canal-${c.id}`}
              className={`rounded-2xl border p-3.5 ${
                c.ligado
                  ? "border-white/12 bg-white/[0.04]"
                  : "border-white/[0.07] bg-white/[0.015]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icone
                  className={`size-4 ${c.ligado ? "text-neon-cyan" : "text-white/25"}`}
                />
                <span className="font-display text-[14px] font-bold text-white">
                  {ROTULO_CANAL[c.id]}
                </span>
                <span className="ml-auto">
                  <Pill accent={c.ligado ? "cyan" : "red"}>
                    {c.ligado ? "Ativo" : "Desligado"}
                  </Pill>
                </span>
              </div>
              <p className="mt-2 font-sans text-[11.5px] leading-relaxed text-white/40">
                {c.nota}
              </p>
              {teste && (
                <p
                  className="mt-2 flex items-start gap-1.5 font-sans text-[11.5px] leading-relaxed"
                  style={{ color: teste.ok ? "#22d3ee" : "#ff1f3d" }}
                >
                  {teste.ok ? (
                    <CheckCircle2 className="mt-[1px] size-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-[1px] size-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 break-words">{teste.detalhe}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {testar.isError && (
        <p className="mt-3 font-sans text-[12px] text-neon-red">
          Não foi possível rodar o teste agora. Tente de novo em alguns segundos.
        </p>
      )}
      {resultados.length > 0 && (
        <p className="mt-3 font-sans text-[11.5px] text-white/35">
          “Ativo” significa configurado; o resultado do teste diz se o canal
          <strong className="text-white/60"> aceitou </strong>
          a mensagem. Confirme no aparelho o que realmente chegou.
        </p>
      )}
    </GlassCard>
  );
}

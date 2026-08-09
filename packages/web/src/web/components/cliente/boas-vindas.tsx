// CHECKLIST DE BOAS-VINDAS — pop-up obrigatorio no primeiro acesso.
// O cliente so entra no painel depois de marcar todas as regras e aceitar.
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { NeonButton } from "../ui/kit";
import { useAceitarTermos } from "../../queries/usuarios";

const REGRAS = [
  {
    id: "senhas",
    titulo: "Não repasso login nem senha para ninguém",
    detalhe:
      "As credenciais são pessoais e intransferíveis. Compartilhar cancela o plano sem reembolso.",
  },
  {
    id: "tela",
    titulo: "Uso apenas 1 tela por app",
    detalhe:
      "Cada assinatura dá direito a uma tela simultânea. Telas extras derrubam o acesso de todos na conta.",
  },
  {
    id: "perfil",
    titulo: "Uso só o meu perfil e não mexo nos outros",
    detalhe:
      "Nunca renomeie, exclua ou entre em perfis que não são seus, e nunca troque a senha da conta matriz.",
  },
  {
    id: "pagamento",
    titulo: "Pago até a data de vencimento",
    detalhe:
      "Depois do vencimento os logins e o suporte ficam bloqueados automaticamente até a regularização.",
  },
  {
    id: "suporte",
    titulo: "Problema de acesso eu resolvo primeiro pelo painel",
    detalhe:
      "Código por e-mail, desbloqueio de TV e assistente de IA resolvem quase tudo em menos de 1 minuto.",
  },
];

export function ChecklistBoasVindas({ nome }: { nome: string }) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const aceitar = useAceitarTermos();
  const [oculto, setOculto] = useState(false);

  const todas = marcadas.length === REGRAS.length;
  if (oculto) return null;

  function alternar(id: string) {
    setMarcadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      data-testid="checklist-boas-vindas"
    >
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/12 bg-[#0b0b0f] p-6 shadow-[0_0_80px_-20px_rgba(255,31,61,0.6)] sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,31,61,0.25) 0%, transparent 70%)" }}
        />

        <div className="relative flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neon-red/40 bg-neon-red/10">
            <ShieldCheck className="size-6 text-neon-red" />
          </span>
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.24em] text-white/40">
              Primeiro acesso
            </div>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
              Boas-vindas, {nome.split(" ")[0]}!
            </h2>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-white/50">
              Antes de liberar seus logins, confirme as 5 regras de uso. Elas existem para manter
              todas as contas estáveis — quem cumpre nunca perde acesso.
            </p>
          </div>
        </div>

        <div className="relative mt-6 space-y-2.5">
          {REGRAS.map((regra, i) => {
            const ativa = marcadas.includes(regra.id);
            return (
              <button
                key={regra.id}
                type="button"
                data-testid={`regra-${regra.id}`}
                onClick={() => alternar(regra.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  ativa
                    ? "border-emerald-400/45 bg-emerald-400/[0.07]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    ativa
                      ? "border-emerald-400 bg-emerald-400 text-black"
                      : "border-white/25 text-transparent"
                  }`}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[13px] font-bold text-white">
                    {i + 1}. {regra.titulo}
                  </span>
                  <span className="mt-1 block font-sans text-[11.5px] leading-relaxed text-white/45">
                    {regra.detalhe}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {aceitar.isError && (
          <p className="relative mt-4 font-sans text-xs text-neon-red">{aceitar.error?.message}</p>
        )}

        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-sans text-[11px] text-white/35">
            {marcadas.length}/{REGRAS.length} confirmadas · o aceite fica registrado com data e hora
          </span>
          <NeonButton
            accent="red"
            size="md"
            data-testid="aceitar-termos"
            disabled={!todas || aceitar.isPending}
            onClick={() => aceitar.mutate({}, { onSuccess: () => setOculto(true) })}
            className={!todas ? "opacity-40" : ""}
          >
            {aceitar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Aceitar e entrar no painel
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

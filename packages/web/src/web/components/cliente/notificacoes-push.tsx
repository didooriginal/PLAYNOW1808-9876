// Card "Avisos no celular" — pede permissão de push e inscreve o aparelho.
//
// Push é o canal AUTOMÁTICO do cliente: vencimento chegando, pagamento
// aprovado, acesso reposto, convite liberado, atraso, cupom de volta e
// promoções chegam sozinhos, sem depender de ninguém clicar no WhatsApp.
//
// No iPhone só funciona com o app instalado na tela de início — por isso o
// aviso aparece antes do botão quando o aparelho é iOS e não está instalado.
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, Loader2, TriangleAlert } from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { ehIOS, estaInstalado } from "@/lib/pwa";
import {
  cancelarInscricao,
  criarInscricao,
  inscricaoAtual,
  permissaoAtual,
  pushSuportado,
} from "@/lib/push-cliente";
import {
  useChavePush,
  useDesinscreverPush,
  useInscreverPush,
  useSituacaoPush,
  useTestarPush,
} from "../../queries/push";

export function NotificacoesPush() {
  const chave = useChavePush();
  const situacao = useSituacaoPush();
  const inscrever = useInscreverPush();
  const desinscrever = useDesinscreverPush();
  const testar = useTestarPush();

  const [ligadoAqui, setLigadoAqui] = useState(false);
  const [erro, setErro] = useState("");
  const [recado, setRecado] = useState("");

  const suportado = pushSuportado();
  const permissao = permissaoAtual();
  const ios = ehIOS();
  const precisaInstalar = ios && !estaInstalado();

  useEffect(() => {
    void inscricaoAtual().then((i) => setLigadoAqui(Boolean(i)));
  }, []);

  const carregando = inscrever.isPending || desinscrever.isPending;

  async function ligar() {
    setErro("");
    setRecado("");
    const resultado = await criarInscricao(chave.data?.chave ?? "");
    if (!resultado.ok) {
      setErro(resultado.motivo);
      return;
    }
    const gravado = await inscrever.mutateAsync(resultado.dados).catch(() => null);
    if (!gravado?.ok) {
      setErro("Não consegui salvar a inscrição. Tente de novo em instantes.");
      return;
    }
    setLigadoAqui(true);
    setRecado("Pronto. Este aparelho vai receber os avisos.");
  }

  async function desligar() {
    setErro("");
    setRecado("");
    const endpoint = await cancelarInscricao();
    if (endpoint) await desinscrever.mutateAsync({ endpoint }).catch(() => null);
    setLigadoAqui(false);
    setRecado("Avisos desligados neste aparelho.");
  }

  async function enviarTeste() {
    setErro("");
    setRecado("");
    const r = await testar.mutateAsync({}).catch(() => null);
    if (!r || r.enviados === 0) {
      setErro("Nenhum aviso saiu. Confira se a permissão continua liberada.");
      return;
    }
    setRecado(`Aviso de teste enviado para ${r.enviados} aparelho(s).`);
  }

  if (!suportado || chave.data?.configurado === false) return null;

  const aparelhos = situacao.data?.aparelhos ?? 0;

  return (
    <GlassCard accent="cyan" className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.24) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10">
            {ligadoAqui ? (
              <BellRing className="size-5 text-neon-cyan" />
            ) : (
              <Bell className="size-5 text-neon-cyan" />
            )}
          </span>
          <div className="min-w-0">
            <Pill accent="cyan">{ligadoAqui ? "Avisos ligados" : "Avisos no celular"}</Pill>
            <h3 className="mt-2 font-display text-lg font-bold text-white">
              Receba os avisos direto na tela
            </h3>
            <p className="mt-1.5 max-w-xl font-sans text-[13px] leading-relaxed text-white/50">
              Vencimento chegando, pagamento aprovado, acesso reposto, convite liberado e
              promoções — tudo na hora, sem precisar abrir o site.
            </p>
            {aparelhos > 0 && (
              <p className="mt-2 font-sans text-[12px] text-white/35">
                {aparelhos} aparelho(s) inscrito(s) na sua conta.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {ligadoAqui ? (
            <>
              <NeonButton
                accent="cyan"
                size="md"
                onClick={enviarTeste}
                disabled={testar.isPending}
                data-testid="push-testar"
              >
                {testar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BellRing className="size-4" />
                )}
                Enviar teste
              </NeonButton>
              <button
                type="button"
                onClick={() => void desligar()}
                disabled={carregando}
                className="inline-flex items-center justify-center gap-1.5 font-sans text-[11px] uppercase tracking-widest text-white/40 transition-colors hover:text-white"
              >
                <BellOff className="size-3.5" />
                Desligar aqui
              </button>
            </>
          ) : (
            <NeonButton
              accent="cyan"
              size="md"
              onClick={() => void ligar()}
              disabled={carregando || permissao === "denied"}
              data-testid="push-ligar"
            >
              {carregando ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Ligar avisos
            </NeonButton>
          )}
        </div>
      </div>

      {precisaInstalar && (
        <div className="relative mt-5 flex gap-3 rounded-2xl border border-neon-purple/25 bg-neon-purple/5 p-4">
          <TriangleAlert className="size-4 shrink-0 text-neon-purple" />
          <p className="font-sans text-[12.5px] leading-relaxed text-white/60">
            No iPhone e iPad os avisos só funcionam com o app instalado na tela de início. Use o
            card <b className="font-semibold text-white/80">Instalar App</b> logo acima e depois
            volte aqui para ligar.
          </p>
        </div>
      )}

      {permissao === "denied" && (
        <div className="relative mt-5 flex gap-3 rounded-2xl border border-neon-red/25 bg-neon-red/5 p-4">
          <TriangleAlert className="size-4 shrink-0 text-neon-red" />
          <p className="font-sans text-[12.5px] leading-relaxed text-white/60">
            As notificações estão bloqueadas para este site. Libere no cadeado da barra de
            endereço e recarregue a página.
          </p>
        </div>
      )}

      {erro && (
        <p className="relative mt-4 font-sans text-[12.5px] text-neon-red/80">{erro}</p>
      )}
      {recado && !erro && (
        <p className="relative mt-4 inline-flex items-center gap-1.5 font-sans text-[12.5px] text-neon-cyan/80">
          <Check className="size-3.5" />
          {recado}
        </p>
      )}
    </GlassCard>
  );
}

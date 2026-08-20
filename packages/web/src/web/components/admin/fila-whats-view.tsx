import { useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Megaphone,
  PhoneOff,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import { Ajuda, Tooltip } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import {
  useDescartarWhats,
  useDispararPromocao,
  useFilaWhats,
  useLimparTratadosWhats,
  useMarcarEnviadoWhats,
} from "../../queries/fila-whats";

/**
 * FILA DE WHATSAPP — disparo manual dos 7 eventos.
 *
 * O push já saiu sozinho no momento do evento. Esta fila é o reforço humano:
 * a mensagem chega pronta, o admin abre o `wa.me`, envia e marca como enviado.
 */

const ROTULO_EVENTO: Record<string, string> = {
  vencimento: "Vencimento chegando",
  pagamento: "Pagamento confirmado",
  acesso: "Acesso reposto",
  convite: "Convite liberado",
  atraso: "Assinatura vencida",
  winback: "Volta com desconto",
  promocao: "Promoção",
};

const FILTROS = [
  { valor: "pendente", label: "Pendentes" },
  { valor: "enviado", label: "Enviados" },
  { valor: "todos", label: "Tudo" },
] as const;

type StatusFiltro = (typeof FILTROS)[number]["valor"];

export function FilaWhatsView() {
  const [status, setStatus] = useState<StatusFiltro>("pendente");
  const { data, isLoading } = useFilaWhats({ status });
  const marcar = useMarcarEnviadoWhats();
  const descartar = useDescartarWhats();
  const limpar = useLimparTratadosWhats();
  const promocao = useDispararPromocao();

  const [copiado, setCopiado] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [campanha, setCampanha] = useState("");
  const [publico, setPublico] = useState<"todos" | "ativos" | "inativos">("todos");
  const [recado, setRecado] = useState("");

  function copiar(id: number, mensagem: string) {
    void navigator.clipboard.writeText(mensagem);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  async function dispararPromocao() {
    setRecado("");
    if (texto.trim().length < 5 || campanha.trim().length < 2) {
      setRecado("Preencha o nome da campanha e o texto da promoção.");
      return;
    }
    const r = await promocao
      .mutateAsync({ texto: texto.trim(), campanha: campanha.trim(), publico })
      .catch(() => null);
    if (!r) {
      setRecado("Não consegui disparar agora. Tente de novo.");
      return;
    }
    setRecado(
      `${r.clientes} cliente(s) na campanha · ${r.push} aviso(s) entregues por push · ${r.fila} na fila do WhatsApp.`,
    );
    setTexto("");
  }

  const itens = data?.itens ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard accent="cyan" className="p-5">
          <MessageCircle className="size-5 text-neon-cyan" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.pendentes ?? 0}
          </div>
          <div className="flex items-center gap-1.5 font-sans text-xs text-white/40">
            mensagens esperando disparo
            <Ajuda ajuda="filawhats.pendentes" />
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <Check className="size-5 text-emerald-400" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.enviados ?? 0}
          </div>
          <div className="font-sans text-xs text-white/40">já enviadas por você</div>
        </GlassCard>
        <GlassCard accent="red" className="p-5">
          <PhoneOff className="size-5 text-neon-red" />
          <div className="mt-3 font-display text-2xl font-extrabold text-white">
            {data?.resumo.semTelefone ?? 0}
          </div>
          <div className="flex items-center gap-1.5 font-sans text-xs text-white/40">
            sem telefone cadastrado
            <Ajuda ajuda="filawhats.semtelefone" />
          </div>
        </GlassCard>
      </div>

      <GlassCard accent="purple" className="p-5">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-neon-purple" />
          <h3 className="font-display text-sm font-bold text-white">Promoção em massa</h3>
          <Ajuda ajuda="filawhats.promocao" />
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/40">
          O push sai na hora para todo mundo que ligou os avisos. O WhatsApp de cada cliente entra
          na fila abaixo para você disparar.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <input
            value={campanha}
            onChange={(e) => setCampanha(e.target.value)}
            placeholder="Nome da campanha (ex.: black-friday)"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
          />
          <select
            value={publico}
            onChange={(e) => setPublico(e.target.value as typeof publico)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white focus:border-neon-purple/50 focus:outline-none"
          >
            <option value="todos">Todos os clientes</option>
            <option value="ativos">Somente em dia</option>
            <option value="inativos">Somente fora do ar</option>
          </select>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Texto da promoção — ele entra depois do primeiro nome do cliente."
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <NeonButton
            accent="purple"
            onClick={() => void dispararPromocao()}
            disabled={promocao.isPending}
            data-testid="disparar-promocao"
          >
            {promocao.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Megaphone className="size-4" />
            )}
            Disparar campanha
          </NeonButton>
          {recado && <span className="font-sans text-xs text-white/50">{recado}</span>}
        </div>
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setStatus(f.valor)}
              className={cn(
                "rounded-xl border px-3 py-1.5 font-sans text-xs transition-colors",
                status === f.valor
                  ? "border-neon-cyan/50 bg-neon-cyan/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Tooltip texto="filawhats.limpar" titulo="Limpar tratados">
          <NeonButton
            accent="red"
            onClick={() => limpar.mutate({})}
            disabled={limpar.isPending}
          >
            {limpar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Limpar tratados
          </NeonButton>
        </Tooltip>
      </div>

      {isLoading && <p className="font-sans text-sm text-white/40">Montando a fila…</p>}

      {!isLoading && itens.length === 0 && (
        <GlassCard className="p-10 text-center">
          <MessageCircle className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-sans text-sm text-white/40">
            Nada na fila. Os avisos entram sozinhos quando os eventos acontecem.
          </p>
        </GlassCard>
      )}

      <div className="space-y-3">
        {itens.map((item) => (
          <GlassCard key={item.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill accent={item.status === "pendente" ? "cyan" : "purple"}>
                    {ROTULO_EVENTO[item.evento] ?? item.evento}
                  </Pill>
                  <span className="font-display text-sm font-bold text-white">{item.cliente}</span>
                  {!item.telefone && (
                    <span className="font-sans text-[11px] text-neon-red/80">sem telefone</span>
                  )}
                </div>
                <p className="mt-2 max-w-3xl font-sans text-[13px] leading-relaxed text-white/55">
                  {item.mensagem}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copiar(item.id, item.mensagem)}
                  aria-label="Copiar mensagem"
                  className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition-colors hover:text-white"
                >
                  {copiado === item.id ? (
                    <Check className="size-4 text-emerald-400" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>

                {item.link && item.status === "pendente" && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 font-sans text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20"
                  >
                    <Send className="size-3.5" />
                    Abrir WhatsApp
                  </a>
                )}

                {item.status === "pendente" && (
                  <>
                    <NeonButton
                      accent="cyan"
                      size="sm"
                      onClick={() => marcar.mutate({ ids: [item.id] })}
                      disabled={marcar.isPending}
                    >
                      <Check className="size-3.5" />
                      Marcar enviado
                    </NeonButton>
                    <button
                      type="button"
                      onClick={() => descartar.mutate({ ids: [item.id] })}
                      aria-label="Descartar"
                      className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/35 transition-colors hover:text-neon-red"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

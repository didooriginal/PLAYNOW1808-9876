import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Users,
  X,
} from "lucide-react";
import { AppIcon } from "../app-icon";
import { Ajuda } from "../ui/tooltip";
import { GlassCard, NeonButton, Pill } from "../ui/kit";
import {
  useAtualizarConvite,
  useCatalogoOpcoes,
  useContasDeConvite,
  useCriarConvite,
  useFilaConvites,
} from "../../queries/planos-apps";
import { useUsuarios } from "../../queries/usuarios";

/**
 * FILA DE CONVITES (membro extra).
 *
 * Algumas opções não são entregues por login e senha de conta matriz: o
 * cliente informa o e-mail dele e o admin o cadastra como membro extra no
 * painel do provedor — quem envia o acesso é o próprio provedor (é o caso da
 * Netflix individual). Esta tela é a fila desses cadastros manuais.
 *
 * O cliente vê o mesmo status no painel dele, então marcar "enviado" aqui é o
 * que tira o "aguardando cadastro" da tela dele.
 */

const STATUS: Record<
  string,
  { rotulo: string; cor: string; descricao: string }
> = {
  pendente: {
    rotulo: "Aguardando cadastro",
    cor: "#fbbf24",
    descricao: "Cadastre este e-mail como membro extra no painel do provedor.",
  },
  enviado: {
    rotulo: "Convite enviado",
    cor: "#22d3ee",
    descricao: "O provedor já mandou o convite. Aguardando o cliente aceitar.",
  },
  ativo: {
    rotulo: "Ativo",
    cor: "#34d399",
    descricao: "Cliente aceitou e está usando.",
  },
  recusado: {
    rotulo: "Recusado",
    cor: "#ff1f3d",
    descricao: "Não foi possível cadastrar — combine outro e-mail com o cliente.",
  },
};

const soDigitos = (v: string) => v.replace(/\D/g, "");

const campo =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white placeholder:text-white/25 focus:border-neon-cyan/60 focus:outline-none";

/* ------------------------------------------------------------------ */
/* LANÇAR CONVITE NA MÃO                                               */
/* ------------------------------------------------------------------ */

/**
 * O cliente que manda o e-mail pelo WhatsApp não gera pedido no sistema — e
 * antes o admin não tinha por onde registrar, então o convite vivia fora do
 * painel. Aqui ele lança na mão já dizendo de qual conta matriz o convite sai.
 */
function LancarConvite({ onFeito }: { onFeito: () => void }) {
  const { data: clientes } = useUsuarios();
  const { data: catalogo } = useCatalogoOpcoes();
  const { data: contas } = useContasDeConvite();
  const criar = useCriarConvite();

  const opcoes = useMemo(
    () =>
      (catalogo ?? []).flatMap((app) =>
        (app.opcoes ?? [])
          .filter((o) => o.entrega === "convite" && o.ativo)
          .map((o) => ({ slug: o.slug, rotulo: `${app.nome} — ${o.nome}` })),
      ),
    [catalogo],
  );

  const [clienteId, setClienteId] = useState("");
  const [servico, setServico] = useState("");
  const [email, setEmail] = useState("");
  const [contaId, setContaId] = useState("");
  const [status, setStatus] = useState<"pendente" | "enviado" | "ativo">("pendente");

  const servicoFinal = servico || opcoes[0]?.slug || "";
  const disponiveis = (contas ?? []).filter((c) => c.livres > 0 || String(c.id) === contaId);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2">
        <Plus className="size-3.5 text-neon-cyan" />
        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-neon-cyan">
          Lançar convite na mão
        </span>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            Cliente
          </span>
          <select
            className={campo}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">selecione…</option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            Opção entregue por convite
          </span>
          <select className={campo} value={servicoFinal} onChange={(e) => setServico(e.target.value)}>
            {opcoes.length === 0 && <option value="">nenhuma opção cadastrada</option>}
            {opcoes.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            E-mail do cliente no provedor
          </span>
          <input
            className={campo}
            type="email"
            placeholder="cliente@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            Conta matriz de onde o convite sai
          </span>
          <select className={campo} value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">ainda não definida</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo} · {c.livres} livre(s)
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
            Situação
          </span>
          <select
            className={campo}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="pendente">Aguardando cadastro</option>
            <option value="enviado">Convite já enviado</option>
            <option value="ativo">Cliente já está ativo</option>
          </select>
        </label>
      </div>

      {criar.isError && (
        <p className="mt-2 font-sans text-[11px] text-neon-red">{criar.error?.message}</p>
      )}

      <NeonButton
        accent="cyan"
        size="sm"
        className="mt-3 w-full"
        disabled={criar.isPending || !clienteId || !servicoFinal || !email.trim()}
        onClick={() =>
          criar.mutate(
            {
              clienteId: Number(clienteId),
              servico: servicoFinal,
              email: email.trim(),
              contaId: contaId ? Number(contaId) : null,
              status,
            },
            {
              onSuccess: () => {
                setEmail("");
                setClienteId("");
                setContaId("");
                setStatus("pendente");
                onFeito();
              },
            },
          )
        }
      >
        {criar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Lançar convite
      </NeonButton>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/* QUEM ESTÁ EM QUAL CONTA                                             */
/* ------------------------------------------------------------------ */

/** As vagas de convite de cada conta liberada e quem ocupa cada uma. */
function ContasDeConvite() {
  const { data, isPending } = useContasDeConvite();
  if (isPending) return null;
  const contas = data ?? [];

  if (contas.length === 0)
    return (
      <GlassCard className="p-4">
        <p className="font-sans text-xs text-white/45">
          Nenhuma conta matriz está liberada para convite individual. Abra a conta em
          Gestão de Contas, marque "liberada para convite individual" e ela aparece aqui
          com as vagas de convite dela.
        </p>
      </GlassCard>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {contas.map((c) => (
        <GlassCard key={c.id} className="p-4">
          <div className="flex items-center gap-2.5">
            <AppIcon id={c.servico} size="sm" active={c.livres > 0} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-bold text-white">{c.rotulo}</div>
              <div className="truncate font-mono text-[10px] text-white/30">{c.email}</div>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 font-display text-[10px] font-bold"
              style={{
                color: c.livres > 0 ? "#22d3ee" : "#ff1f3d",
                background: c.livres > 0 ? "#22d3ee18" : "#ff1f3d18",
              }}
            >
              {c.ocupantes.length}/{c.convitesMaximos}
            </span>
          </div>

          <ul className="mt-3 space-y-1.5">
            {c.ocupantes.map((o) => (
              <li
                key={o.conviteId}
                className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5"
              >
                <Users className="size-3 shrink-0 text-white/25" />
                <span className="min-w-0 flex-1 truncate font-sans text-[11px] text-white/70">
                  {o.cliente}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-white/30">{o.status}</span>
              </li>
            ))}
            {Array.from({ length: c.livres }).map((_, i) => (
              <li
                key={`livre-${i}`}
                className="rounded-xl border border-dashed border-white/10 px-2.5 py-1.5 font-sans text-[11px] text-white/25"
              >
                vaga de convite livre
              </li>
            ))}
          </ul>
        </GlassCard>
      ))}
    </div>
  );
}

export function ConvitesView() {
  const { data, isPending, isError, error } = useFilaConvites();
  const { data: contasConvite } = useContasDeConvite();
  const atualizar = useAtualizarConvite();
  const [lancando, setLancando] = useState(false);
  /** conta escolhida por convite antes de marcar enviado/ativo */
  const [contaPorConvite, setContaPorConvite] = useState<Record<number, string>>({});

  if (isError)
    return (
      <GlassCard accent="red" className="p-8 text-center">
        <AlertTriangle className="mx-auto size-6 text-neon-red" />
        <p className="mt-3 font-display text-sm font-bold text-white">
          Erro ao carregar a fila de convites
        </p>
        <p className="mt-1.5 font-sans text-xs text-white/45">{error?.message}</p>
      </GlassCard>
    );

  if (isPending)
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="size-5 animate-spin text-white/30" />
      </div>
    );

  const fila = data ?? [];
  const pendentes = fila.filter((c) => c.status === "pendente");

  /** conta escolhida no seletor, caindo na que já estava gravada no convite */
  const escolhida = (id: number, atual: number | null) => {
    const bruto = contaPorConvite[id];
    if (bruto === undefined) return atual;
    return bruto ? Number(bruto) : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill accent={pendentes.length ? "red" : "cyan"} icon={<Clock className="size-3" />}>
          {pendentes.length} aguardando cadastro
        </Pill>
        <Ajuda ajuda="secao.convites" />
        <button
          type="button"
          onClick={() => setLancando((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/40 px-3 py-1.5 font-sans text-[11px] text-neon-cyan transition-colors hover:bg-neon-cyan/10"
        >
          <Plus className="size-3" />
          {lancando ? "fechar" : "lançar convite na mão"}
        </button>
      </div>

      {lancando && <LancarConvite onFeito={() => setLancando(false)} />}

      {/* quem está em qual conta matriz — as 2 vagas de convite por conta */}
      <ContasDeConvite />

      {fila.length === 0 && (
        <GlassCard className="p-10 text-center">
          <Mail className="mx-auto size-6 text-white/25" />
          <p className="mt-3 font-display text-sm font-bold text-white">Nenhum convite na fila</p>
          <p className="mx-auto mt-1.5 max-w-md font-sans text-xs leading-relaxed text-white/40">
            Quando um cliente contratar uma opção entregue por convite — como a Netflix
            individual — o pedido aparece aqui com o e-mail dele. Você também pode lançar
            um convite na mão pelo botão acima.
          </p>
        </GlassCard>
      )}

      <ul className="space-y-3">
        {fila.map((c) => {
          const st = STATUS[c.status] ?? STATUS.pendente;
          const zap = soDigitos(c.whatsapp || "");
          return (
            <li key={c.id}>
              <GlassCard className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <AppIcon id={c.servico} size="sm" active />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold text-white">
                      {c.cliente}
                    </div>
                    <div className="font-mono text-[11px] text-white/35">{c.servico}</div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold"
                    style={{ color: st.cor, background: `${st.cor}18` }}
                  >
                    {st.rotulo}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <Mail className="size-3.5 shrink-0 text-white/30" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                    {c.email}
                  </span>
                  <button
                    type="button"
                    aria-label="Copiar e-mail do cliente"
                    onClick={() => navigator.clipboard?.writeText(c.email)}
                    className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
                  >
                    <Copy className="size-3" />
                  </button>
                  {zap && (
                    <a
                      href={`https://wa.me/55${zap}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Falar com o cliente no WhatsApp"
                      className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-emerald-400/50 hover:text-emerald-400"
                    >
                      <MessageCircle className="size-3" />
                    </a>
                  )}
                </div>

                <p className="mt-2 font-sans text-[11px] text-white/40">{st.descricao}</p>

                {/*
                  * DE QUAL CONTA SAIU. Obrigatório para marcar enviado/ativo:
                  * sem isso ninguém sabia em qual matriz o cliente entrou e as
                  * vagas de convite de cada conta ficavam impossíveis de contar.
                  */}
                <label className="mt-3 block">
                  <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Conta matriz de onde o convite sai
                  </span>
                  <select
                    className={campo}
                    aria-label="Conta matriz do convite"
                    value={contaPorConvite[c.id] ?? (c.contaId ? String(c.contaId) : "")}
                    onChange={(e) =>
                      setContaPorConvite((m) => ({ ...m, [c.id]: e.target.value }))
                    }
                  >
                    <option value="">selecione a conta…</option>
                    {(contasConvite ?? [])
                      .filter(
                        (ct) => ct.livres > 0 || ct.ocupantes.some((o) => o.conviteId === c.id),
                      )
                      .map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.rotulo} · {ct.livres} livre(s)
                        </option>
                      ))}
                  </select>
                </label>

                {atualizar.isError && (
                  <p className="mt-2 font-sans text-[11px] text-neon-red">
                    {atualizar.error?.message}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status !== "enviado" && (
                    <button
                      type="button"
                      aria-label="Marcar convite como enviado"
                      disabled={atualizar.isPending}
                      onClick={() =>
                        atualizar.mutate({
                          id: c.id,
                          status: "enviado",
                          contaId: escolhida(c.id, c.contaId),
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/40 px-3 py-1.5 font-sans text-[11px] text-neon-cyan transition-colors hover:bg-neon-cyan/10"
                    >
                      <Mail className="size-3" />
                      Convite enviado
                    </button>
                  )}
                  {c.status !== "ativo" && (
                    <button
                      type="button"
                      aria-label="Marcar cliente como ativo"
                      disabled={atualizar.isPending}
                      onClick={() =>
                        atualizar.mutate({
                          id: c.id,
                          status: "ativo",
                          contaId: escolhida(c.id, c.contaId),
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 px-3 py-1.5 font-sans text-[11px] text-emerald-400 transition-colors hover:bg-emerald-400/10"
                    >
                      <Check className="size-3" />
                      Aceitou / está ativo
                    </button>
                  )}
                  {c.status !== "recusado" && (
                    <button
                      type="button"
                      aria-label="Marcar convite como recusado"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ id: c.id, status: "recusado" })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 font-sans text-[11px] text-white/45 transition-colors hover:border-neon-red/50 hover:text-neon-red"
                    >
                      <X className="size-3" />
                      Não deu certo
                    </button>
                  )}
                </div>
              </GlassCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

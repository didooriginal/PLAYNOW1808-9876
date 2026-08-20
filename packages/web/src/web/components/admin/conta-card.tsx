import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Pencil,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Power,
  Lock,
  LockOpen,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sugerirCaptura } from "@/lib/captura-email";
import { CampoSenha } from "../ui/campo-senha";
import { AppIcon } from "../app-icon";
import { GlassCard, NeonButton, ProgressBar } from "../ui/kit";
import { SeloSalvo, useSeloTransitorio } from "./salvamento";
import { Campo, Rotulo, Tooltip } from "../ui/tooltip";
import { SelectServico } from "./select-servico";
import { brl, serviceById } from "@/lib/mock-data";
import {
  useAlternarContaAtiva,
  useAlternarTravaVagas,
  useContas,
  useAtualizarConta,
  useEditarVagas,
  useRemoverConta,
  useReporConta,
  useSincronizarUmaConta,
} from "../../queries/contas";
import {
  useAlocarCliente,
  useClientesDisponiveis,
  useLiberarVaga,
  useMapaAlocacoes,
} from "../../queries/alocacoes";

type Conta = NonNullable<ReturnType<typeof useContas>["data"]>[number];
type Vinculo = NonNullable<
  ReturnType<typeof useMapaAlocacoes>["data"]
>[number][number];

/** dias até o vencimento da matriz — null quando não há data cadastrada */
export function diasParaVencer(iso: string) {
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

const dataBR = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "—";

/** tarja de alerta de vencimento: vermelha se vencida, âmbar se faltam ≤ 5 dias */
function VencimentoAlerta({ conta }: { conta: Conta }) {
  const dias = diasParaVencer(conta.dataVencimento);
  if (dias === null || dias > 5) return null;

  const vencida = dias < 0;
  const hex = vencida ? "#ff1f3d" : "#f59e0b";
  const texto = vencida
    ? `Assinatura vencida há ${Math.abs(dias)} dia(s)`
    : dias === 0
      ? "Vence hoje"
      : `Vence em ${dias} dia(s)`;

  return (
    <div
      className="relative mt-4 flex items-center gap-2 rounded-xl border px-3 py-2"
      style={{ borderColor: `${hex}55`, background: `${hex}14`, color: hex }}
    >
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="font-display text-[11px] font-bold uppercase tracking-wide">
        {texto}
      </span>
      <span className="ml-auto font-sans text-[10px] text-white/45">
        {dataBR(conta.dataVencimento)}
      </span>
    </div>
  );
}

/** lista de clientes vinculados + ação de liberar vaga individual */
function ClientesVinculados({
  conta,
  vinculos,
}: {
  conta: Conta;
  vinculos: Vinculo[];
}) {
  const [alocando, setAlocando] = useState(false);
  const [escolhido, setEscolhido] = useState<number | "">("");
  /** aviso de troca: o cliente saiu de outra conta do mesmo app */
  const [movidoDe, setMovidoDe] = useState<string[]>([]);
  const disponiveis = useClientesDisponiveis(conta.id, alocando);
  const alocar = useAlocarCliente();
  const liberar = useLiberarVaga();
  const livres = conta.totalVagas - vinculos.length;

  return (
    <div className="relative mt-4 border-t border-white/8 pt-4">
      <div className="flex items-center gap-2">
        <Users className="size-3.5 text-white/35" />
        <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
          Clientes nesta conta ({vinculos.length})
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {vinculos.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                v.clienteStatus === "ativo"
                  ? "bg-emerald-400"
                  : v.clienteStatus === "pendente"
                    ? "bg-amber-400"
                    : "bg-neon-red",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[11px] font-bold text-white">
                {v.clienteNome}
              </div>
              <div className="truncate font-mono text-[9px] text-white/30">
                {v.clienteEmail}
              </div>
            </div>
            <Tooltip texto="conta.liberarVaga" titulo="Liberar vaga">
              <button
                type="button"
                aria-label={`Liberar vaga de ${v.clienteNome}`}
                disabled={liberar.isPending}
                onClick={() => liberar.mutate({ id: v.id, motivo: "manual" })}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-amber-400/50 hover:text-amber-300"
              >
                <UserMinus className="size-3" />
              </button>
            </Tooltip>
          </div>
        ))}
        {vinculos.length === 0 && (
          <p className="font-sans text-[11px] text-white/30">
            Nenhum cliente vinculado ainda.
          </p>
        )}
      </div>

      {alocando ? (
        <div className="mt-3 space-y-2">
          <select
            aria-label="Cliente que vai ocupar a vaga"
            value={escolhido}
            onChange={(e) =>
              setEscolhido(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white focus:border-neon-cyan/50 focus:outline-none"
          >
            <option value="" className="bg-[#09090b]">
              Selecione o cliente...
            </option>
            {(disponiveis.data ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-[#09090b]">
                {c.nome} · {c.email}
              </option>
            ))}
          </select>
          {alocar.isError && (
            <p className="font-sans text-[11px] text-neon-red">
              {alocar.error?.message}
            </p>
          )}
          <div className="flex gap-2">
            <NeonButton
              accent="cyan"
              size="sm"
              className="flex-1"
              data-testid={`confirmar-vinculo-${conta.id}`}
              disabled={!escolhido || alocar.isPending}
              onClick={() =>
                escolhido &&
                alocar.mutate(
                  { clienteId: Number(escolhido), contaId: conta.id },
                  {
                    onSuccess: (res) => {
                      setEscolhido("");
                      setAlocando(false);
                      setMovidoDe(
                        res?.trocou
                          ? res.contasAnteriores.map((c) => c.rotulo)
                          : [],
                      );
                    },
                  },
                )
              }
            >
              {alocar.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Vincular
            </NeonButton>
            <button
              type="button"
              onClick={() => setAlocando(false)}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white"
              aria-label="Cancelar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <NeonButton
          accent="cyan"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          data-testid={`vincular-cliente-${conta.id}`}
          disabled={livres <= 0}
          onClick={() => setAlocando(true)}
        >
          <UserPlus className="size-3.5" />
          {livres > 0 ? "Vincular cliente" : "Sem vagas livres"}
        </NeonButton>
      )}

      {movidoDe.length > 0 && (
        <div
          data-testid={`aviso-movido-${conta.id}`}
          className="mt-3 flex items-start justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2"
        >
          <p className="font-sans text-[11px] leading-relaxed text-amber-200/80">
            Movido de <span className="font-semibold">{movidoDe.join(", ")}</span> — a vaga
            antiga do mesmo app foi liberada automaticamente.
          </p>
          <button
            type="button"
            aria-label="Fechar aviso de troca de conta"
            onClick={() => setMovidoDe([])}
            className="text-amber-200/50 hover:text-amber-200"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/** editor inline do total de vagas */
function EditorVagas({
  conta,
  onClose,
  onSalvo,
}: {
  conta: Conta;
  onClose: () => void;
  /** avisa o card para acender o selo "Salvo" depois que o editor fecha */
  onSalvo: () => void;
}) {
  const [valor, setValor] = useState(conta.totalVagas);
  const editar = useEditarVagas();

  return (
    <div className="relative mt-4 rounded-2xl border border-neon-purple/35 bg-neon-purple/8 p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-wide text-neon-purple">
          Editar vagas
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[11px] text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>
      <Rotulo
        ajuda="contas.totalVagas"
        htmlFor="conta-vagas"
        className="mt-2.5"
      >
        Total de vagas
      </Rotulo>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          aria-label="Diminuir"
          onClick={() => setValor((v) => Math.max(1, v - 1))}
          className="size-9 shrink-0 rounded-xl border border-white/12 font-display text-sm text-white/70 hover:text-white"
        >
          −
        </button>
        <input
          id="conta-vagas"
          type="number"
          min={1}
          max={50}
          aria-label="Total de vagas"
          value={valor}
          onChange={(e) => {
            const n = Number(e.target.value);
            // campo vazio nao vira 0: mantem o valor atual ate digitar de novo
            setValor(Number.isFinite(n) && n > 0 ? Math.min(50, n) : valor);
          }}
          /*
           * SEM RODA DO MOUSE. Input number muda de valor quando a roda gira
           * com o campo focado — era assim que o total de vagas "diminuia
           * sozinho" ao rolar a pagina depois de clicar no campo.
           */
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-display text-sm font-bold text-white focus:border-neon-purple/60 focus:outline-none"
        />
        <button
          type="button"
          aria-label="Aumentar"
          onClick={() => setValor((v) => Math.min(50, v + 1))}
          className="size-9 shrink-0 rounded-xl border border-white/12 font-display text-sm text-white/70 hover:text-white"
        >
          +
        </button>
      </div>
      {editar.isError && (
        <p className="mt-2 font-sans text-[11px] text-neon-red">
          {editar.error?.message}
        </p>
      )}
      <NeonButton
        accent="purple"
        size="sm"
        className="mt-2.5 w-full"
        disabled={editar.isPending || valor === conta.totalVagas}
        onClick={() =>
          editar.mutate(
            { id: conta.id, totalVagas: valor },
            {
              onSuccess: () => {
                onSalvo();
                onClose();
              },
            },
          )
        }
      >
        {editar.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        Salvar vagas
      </NeonButton>
    </div>
  );
}

/**
 * EDITOR COMPLETO DA MATRIZ
 * ------------------------------------------------------------------
 * Antes só dava para mexer nas vagas: e-mail ou senha errados obrigavam a
 * apagar a conta e cadastrar de novo (perdendo os vínculos). Aqui todos os
 * campos do cadastro voltam preenchidos e salvam via `contas.atualizar`.
 */
function EditorConta({
  conta,
  onClose,
  onSalvo,
}: {
  conta: Conta;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const atualizar = useAtualizarConta();
  const [form, setForm] = useState({
    rotulo: conta.rotulo,
    servico: conta.servico,
    email: conta.email,
    emailCaptura: conta.emailCaptura ?? "",
    senha: conta.senha,
    custo: conta.custo,
    dataVencimento: conta.dataVencimento ?? "",
    cartaoUtilizado: conta.cartaoUtilizado ?? "",
    regiao: conta.regiao ?? "BR",
    observacao: conta.observacao ?? "",
    liberaIndividual: conta.liberaIndividual,
    convitesMaximos: conta.convitesMaximos,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-sans text-xs text-white placeholder:text-white/25 focus:border-neon-purple/60 focus:outline-none";

  return (
    <div className="relative mt-4 rounded-2xl border border-neon-purple/35 bg-neon-purple/8 p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-wide text-neon-purple">
          Editar conta
        </span>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[11px] text-white/40 hover:text-white"
        >
          cancelar
        </button>
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <Campo
          label="Rótulo"
          ajuda="contas.rotulo"
          htmlFor={`ec-rotulo-${conta.id}`}
        >
          <input
            id={`ec-rotulo-${conta.id}`}
            className={input}
            value={form.rotulo}
            onChange={(e) => set("rotulo", e.target.value)}
          />
        </Campo>
        <Campo
          label="Serviço"
          ajuda="contas.servico"
          htmlFor={`ec-servico-${conta.id}`}
        >
          <SelectServico
            id={`ec-servico-${conta.id}`}
            value={form.servico}
            onChange={(v) => set("servico", v)}
            className={input}
          />
        </Campo>
        <Campo
          label="E-mail do streaming"
          ajuda="contas.email"
          htmlFor={`ec-email-${conta.id}`}
        >
          <input
            id={`ec-email-${conta.id}`}
            className={input}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Campo>
        <Campo
          label="E-mail de captura de códigos"
          ajuda="contas.emailCaptura"
          htmlFor={`ec-captura-${conta.id}`}
        >
          <div className="flex gap-2">
            <input
              id={`ec-captura-${conta.id}`}
              className={input}
              placeholder="netflix01@mail.playplusnow.com.br"
              value={form.emailCaptura}
              onChange={(e) => set("emailCaptura", e.target.value)}
            />
            <button
              type="button"
              onClick={() => set("emailCaptura", sugerirCaptura(form.servico, conta.id))}
              className="shrink-0 rounded-xl border border-neon-cyan/35 px-2.5 font-sans text-[11px] text-neon-cyan transition-colors hover:bg-neon-cyan/10"
            >
              sugerir
            </button>
          </div>
        </Campo>
        <Campo
          label="Senha"
          ajuda="contas.senha"
          htmlFor={`ec-senha-${conta.id}`}
        >
          <CampoSenha
            id={`ec-senha-${conta.id}`}
            className={input}
            value={form.senha}
            onChange={(v) => set("senha", v)}
            copiavel
          />
        </Campo>
        <Campo
          label="Custo mensal"
          ajuda="contas.custoMensal"
          htmlFor={`ec-custo-${conta.id}`}
        >
          <input
            id={`ec-custo-${conta.id}`}
            className={input}
            type="number"
            step="0.01"
            min={0}
            value={form.custo}
            onChange={(e) => set("custo", Number(e.target.value))}
          />
        </Campo>
        <Campo
          label="Data de vencimento"
          ajuda="contas.vencimento"
          htmlFor={`ec-venc-${conta.id}`}
        >
          <input
            id={`ec-venc-${conta.id}`}
            className={input}
            type="date"
            value={form.dataVencimento}
            onChange={(e) => set("dataVencimento", e.target.value)}
          />
        </Campo>
        <Campo
          label="Cartão utilizado"
          ajuda="contas.cartao"
          htmlFor={`ec-cartao-${conta.id}`}
        >
          <input
            id={`ec-cartao-${conta.id}`}
            className={input}
            placeholder="Ex.: Nubank final 4412"
            value={form.cartaoUtilizado}
            onChange={(e) => set("cartaoUtilizado", e.target.value)}
          />
        </Campo>
        <Campo
          label="Região"
          ajuda="contas.regiao"
          htmlFor={`ec-regiao-${conta.id}`}
        >
          <input
            id={`ec-regiao-${conta.id}`}
            className={input}
            value={form.regiao}
            onChange={(e) => set("regiao", e.target.value)}
          />
        </Campo>
        {/*
          * CONVITE INDIVIDUAL (membro extra). Só as contas marcadas aqui
          * aparecem como destino do convite, para o individual não furar o
          * estoque do compartilhado.
          */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:col-span-2">
          <label className="flex items-center gap-2 font-sans text-xs text-white/70">
            <input
              type="checkbox"
              checked={form.liberaIndividual}
              onChange={(e) => set("liberaIndividual", e.target.checked)}
              className="size-4 accent-[#22d3ee]"
            />
            Liberada para convite individual (membro extra)
          </label>
          {form.liberaIndividual && (
            <div className="mt-2 flex items-center gap-2">
              <label
                htmlFor={`ec-convites-${conta.id}`}
                className="font-sans text-[11px] text-white/40"
              >
                Convites que esta conta comporta
              </label>
              <input
                id={`ec-convites-${conta.id}`}
                type="number"
                min={0}
                max={10}
                value={form.convitesMaximos}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set(
                    "convitesMaximos",
                    Number.isFinite(n) && n >= 0 ? Math.min(10, n) : form.convitesMaximos,
                  );
                }}
                className="w-16 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center font-display text-xs font-bold text-white focus:border-neon-cyan/60 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <Campo
            label="Observação"
            ajuda="contas.observacao"
            htmlFor={`ec-obs-${conta.id}`}
          >
            <textarea
              id={`ec-obs-${conta.id}`}
              rows={2}
              className={input}
              placeholder="Anotações internas sobre esta matriz"
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
            />
          </Campo>
        </div>
      </div>

      {atualizar.isError && (
        <p className="mt-2 font-sans text-[11px] text-neon-red">
          {atualizar.error?.message}
        </p>
      )}

      <NeonButton
        accent="purple"
        size="sm"
        className="mt-2.5 w-full"
        disabled={
          atualizar.isPending ||
          !form.rotulo.trim() ||
          !form.email.trim() ||
          !form.senha.trim()
        }
        onClick={() =>
          atualizar.mutate(
            {
              id: conta.id,
              ...form,
              rotulo: form.rotulo.trim(),
              email: form.email.trim(),
              emailCaptura: form.emailCaptura.trim().toLowerCase(),
              senha: form.senha.trim(),
              observacao: form.observacao.trim() || null,
            },
            {
              onSuccess: () => {
                onSalvo();
                onClose();
              },
            },
          )
        }
      >
        {atualizar.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        Salvar conta
      </NeonButton>
    </div>
  );
}

export function ContaMatrizCard({
  acc,
  vinculos,
}: {
  acc: Conta;
  vinculos: Vinculo[];
}) {
  const service = serviceById(acc.servico);
  /**
   * FONTE DE VERDADE DAS VAGAS = `acc.vagasOcupadas`, a coluna que o alocador
   * usa para decidir se ainda cabe cliente. O card mostrava a contagem viva de
   * vínculos (`vinculos.length`), então o mesmo número aparecia diferente aqui
   * e no alocador — era isso que dava a impressão de "mudar sozinho ao salvar".
   * A contagem viva continua visível logo abaixo, como conferência.
   */
  const ocupadas = acc.vagasOcupadas;
  const vinculadas = vinculos.length;
  const divergente = vinculadas !== ocupadas;
  const pct = Math.round((ocupadas / Math.max(acc.totalVagas, 1)) * 100);
  const full = ocupadas >= acc.totalVagas;
  const nearly = !full && pct >= 75;

  const trava = useAlternarTravaVagas();
  const sincronizarUma = useSincronizarUmaConta();

  const [editando, setEditando] = useState(false);
  const [editandoConta, setEditandoConta] = useState(false);
  const [aberto, setAberto] = useState(false);

  const repor = useReporConta();
  const remover = useRemoverConta();
  const alternar = useAlternarContaAtiva();
  const busy = repor.isPending || remover.isPending || alternar.isPending;

  /**
   * Aviso pós-remanejo: quem foi realocado em outra matriz e quem ficou sem
   * vaga. Sem isso o admin desligava uma conta sem saber que deixou cliente
   * na mão — o dado existe no retorno, só faltava aparecer na tela.
   */
  const remanejo = alternar.data?.realocados?.length || alternar.data?.semVaga?.length
    ? { realocados: alternar.data.realocados, semVaga: alternar.data.semVaga }
    : repor.data?.realocados?.length || repor.data?.semVaga?.length
      ? { realocados: repor.data.realocados, semVaga: repor.data.semVaga }
      : null;

  /** selo "Salvo" do card: vagas editadas ou vagas repostas */
  const [salvos, setSalvos] = useState(0);
  const marcarSalvo = () => setSalvos((n) => n + 1);
  const selo = useSeloTransitorio({
    salvando: repor.isPending,
    erro: repor.isError
      ? (repor.error?.message ?? "Falha ao repor vagas")
      : null,
    sucessos: salvos,
  });

  const dias = diasParaVencer(acc.dataVencimento);
  const alerta = dias !== null && dias <= 5;

  return (
    <GlassCard
      hover
      className="relative flex flex-col overflow-hidden p-5"
      style={
        full || (dias !== null && dias < 0)
          ? {
              borderColor: "rgba(255,31,61,0.45)",
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(255,31,61,0.15), 0 0 34px -8px rgba(255,31,61,0.5)",
            }
          : alerta
            ? {
                borderColor: "rgba(245,158,11,0.45)",
                boxShadow:
                  "inset 0 1px 0 0 rgba(255,255,255,0.07), 0 0 30px -10px rgba(245,158,11,0.55)",
              }
            : undefined
      }
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 size-36 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${full ? "rgba(255,31,61,0.3)" : `${service.color}2b`} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppIcon id={acc.servico} size="sm" active={!full} />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-white">
              {acc.rotulo}
            </div>
            <div className="truncate font-mono text-[10px] text-white/30">
              {acc.email}
            </div>
          </div>
        </div>
        {full ? (
          <span
            className="shrink-0 rounded-full border border-neon-red/50 bg-neon-red/15 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-neon-red"
            style={{ boxShadow: "0 0 20px -6px #ff1f3d" }}
          >
            Esgotado
          </span>
        ) : nearly ? (
          <span className="shrink-0 rounded-full border border-amber-400/45 bg-amber-400/12 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Quase cheio
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Disponível
          </span>
        )}
      </div>

      <VencimentoAlerta conta={acc} />

      {/* lotação */}
      <div className="relative mt-5">
        <div className="flex items-end justify-between">
          <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white/35">
            Lotação
            {selo && <SeloSalvo estado={selo} />}
          </span>
          <span
            className="font-display text-lg font-extrabold"
            style={{ color: full ? "#ff1f3d" : nearly ? "#f59e0b" : "#22d3ee" }}
          >
            {ocupadas}/{acc.totalVagas}
            <span className="ml-1.5 font-sans text-[11px] font-medium text-white/35">
              vagas ocupadas
            </span>
          </span>
        </div>
        <ProgressBar value={ocupadas} max={acc.totalVagas} className="mt-2.5" />
        <div className="mt-2 flex items-center justify-between font-sans text-[11px] text-white/30">
          <span>{pct}% de ocupação</span>
          <span>
            {full
              ? "0 vagas livres"
              : `${acc.totalVagas - ocupadas} vaga(s) livre(s)`}
          </span>
        </div>

        {/* trava fisica: com ela ligada nada automatico recalcula as vagas */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={
              acc.vagasTravadas
                ? "Destravar as vagas desta conta"
                : "Travar as vagas desta conta"
            }
            disabled={trava.isPending}
            onClick={() => trava.mutate({ id: acc.id, travar: !acc.vagasTravadas })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest transition-colors",
              acc.vagasTravadas
                ? "border-neon-cyan/50 bg-neon-cyan/12 text-neon-cyan"
                : "border-white/12 text-white/40 hover:text-white",
            )}
          >
            {trava.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : acc.vagasTravadas ? (
              <Lock className="size-3" />
            ) : (
              <LockOpen className="size-3" />
            )}
            {acc.vagasTravadas ? "vagas travadas" : "travar vagas"}
          </button>
          <span className="font-sans text-[10px] text-white/30">
            {acc.vagasTravadas
              ? "só muda quando você mudar"
              : `${vinculadas} vínculo(s) ativo(s) no sistema`}
          </span>
        </div>

        {/* numero gravado x alocacoes reais: mostra a diferenca em vez de esconder */}
        {divergente && (
          <div className="mt-2 rounded-xl border border-amber-400/35 bg-amber-400/8 px-3 py-2">
            <p className="font-sans text-[11px] text-amber-200/90">
              O número gravado é {ocupadas}, mas existem {vinculadas} cliente(s)
              alocado(s) de verdade.
            </p>
            {acc.vagasTravadas ? (
              <p className="mt-1 font-sans text-[10px] text-white/40">
                As vagas estão travadas — destrave se quiser igualar ao real.
              </p>
            ) : (
              <button
                type="button"
                disabled={sincronizarUma.isPending}
                onClick={() =>
                  sincronizarUma.mutate(
                    { id: acc.id },
                    { onSuccess: () => marcarSalvo() },
                  )
                }
                className="mt-1.5 inline-flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-amber-200 hover:text-white"
              >
                {sincronizarUma.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                igualar ao real ({vinculadas})
              </button>
            )}
            {sincronizarUma.isError && (
              <p className="mt-1 font-sans text-[10px] text-neon-red">
                {sincronizarUma.error?.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* meta */}
      <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4 sm:grid-cols-4">
        {[
          {
            label: "Vencimento",
            value: dataBR(acc.dataVencimento),
            Icon: CalendarClock,
          },
          {
            label: "Cartão",
            value: acc.cartaoUtilizado || "—",
            Icon: CreditCard,
          },
          { label: "Custo", value: brl(acc.custo), Icon: null },
          { label: "Região", value: acc.regiao, Icon: null },
        ].map((m) => (
          <div key={m.label} className="min-w-0">
            <div className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/25">
              {m.label}
            </div>
            <div className="mt-0.5 truncate font-display text-xs font-bold text-white/80">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {editandoConta && (
        <EditorConta
          conta={acc}
          onClose={() => setEditandoConta(false)}
          onSalvo={marcarSalvo}
        />
      )}

      {editando && (
        <EditorVagas
          conta={acc}
          onClose={() => setEditando(false)}
          onSalvo={marcarSalvo}
        />
      )}

      <button
        type="button"
        data-testid={`abrir-clientes-${acc.id}`}
        onClick={() => setAberto((v) => !v)}
        className="relative mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 font-sans text-[11px] text-white/50 transition-colors hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Users className="size-3.5" />
          {vinculadas} cliente(s) vinculado(s)
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && <ClientesVinculados conta={acc} vinculos={vinculos} />}

      <div className="relative mt-4 flex flex-wrap gap-2">
        <NeonButton
          accent="purple"
          variant="outline"
          size="sm"
          className="flex-1 whitespace-nowrap px-2"
          disabled={busy}
          onClick={() => {
            setEditandoConta(false);
            setEditando((v) => !v);
          }}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          Vagas
        </NeonButton>
        <NeonButton
          accent="cyan"
          variant="outline"
          size="sm"
          className="flex-1 whitespace-nowrap px-2"
          data-testid={`editar-conta-${acc.id}`}
          disabled={busy}
          onClick={() => {
            setEditando(false);
            setEditandoConta((v) => !v);
          }}
        >
          <Pencil className="size-3.5 shrink-0" />
          Editar conta
        </NeonButton>
        <Tooltip
          texto="conta.liberarTodas"
          titulo="Repor vagas"
          className="flex-1"
        >
          <NeonButton
            accent="red"
            variant="outline"
            size="sm"
            className="w-full whitespace-nowrap px-2"
            disabled={busy || ocupadas === 0}
            onClick={() => {
              if (
                confirm(
                  `Repor as vagas de ${acc.rotulo}? ${ocupadas} cliente(s) serão remanejados para outras contas matrizes do mesmo serviço. Quem não couber entra na fila e o ADM é avisado.`,
                )
              ) {
                repor.mutate({ id: acc.id }, { onSuccess: marcarSalvo });
              }
            }}
          >
            {repor.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Repor
          </NeonButton>
        </Tooltip>
        <Tooltip
          texto="conta.ativa"
          titulo={acc.ativa ? "Desligar conta matriz" : "Religar conta matriz"}
        >
          <button
            type="button"
            data-testid={`conta-ativa-${acc.id}`}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
              acc.ativa
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:border-neon-red/50 hover:text-neon-red"
                : "border-neon-red/45 bg-neon-red/10 text-neon-red hover:border-emerald-400/50 hover:text-emerald-300",
            )}
            aria-label={
              acc.ativa
                ? `Desligar a conta matriz ${acc.rotulo}`
                : `Religar a conta matriz ${acc.rotulo}`
            }
            disabled={busy}
            onClick={() => {
              const msg = acc.ativa
                ? `Desligar ${acc.rotulo}? ${ocupadas} cliente(s) serão remanejados para outra matriz do mesmo serviço e a conta para de receber novos.`
                : `Religar ${acc.rotulo}? A conta volta a receber clientes e a fila de espera é atendida automaticamente.`;
              if (confirm(msg)) alternar.mutate({ id: acc.id, ativa: !acc.ativa });
            }}
          >
            {alternar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Power className="size-3.5" />
            )}
          </button>
        </Tooltip>
        <Tooltip texto="conta.copiarLogin" titulo="Copiar login">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-white/25 hover:text-white"
            aria-label="Copiar login"
            onClick={() =>
              navigator.clipboard
                ?.writeText(`${acc.email} · ${acc.senha}`)
                .catch(() => {})
            }
          >
            <Copy className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip texto="conta.excluir" titulo="Excluir conta matriz">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:border-neon-red/50 hover:text-neon-red"
            aria-label="Excluir conta matriz"
            disabled={busy}
            onClick={() => remover.mutate({ id: acc.id })}
          >
            <Trash2 className="size-3.5" />
          </button>
        </Tooltip>
      </div>

      {remanejo && (
        <div
          className={cn(
            "relative mt-3 rounded-xl border p-3 font-sans text-[11px]",
            remanejo.semVaga.length
              ? "border-neon-red/25 bg-neon-red/5 text-neon-red"
              : "border-emerald-400/25 bg-emerald-400/5 text-emerald-300",
          )}
        >
          {remanejo.realocados.length > 0 && (
            <div>{remanejo.realocados.length} cliente(s) realocados em outra matriz.</div>
          )}
          {remanejo.semVaga.length > 0 && (
            <div className="mt-0.5">
              {remanejo.semVaga.length} cliente(s) sem vaga — entraram na fila e o ADM foi
              avisado.
            </div>
          )}
        </div>
      )}

      {!acc.ativa && (
        <div className="relative mt-3 rounded-xl border border-white/12 bg-white/[0.03] p-3 font-sans text-[11px] text-white/45">
          Conta desligada — não recebe novos clientes.
        </div>
      )}
    </GlassCard>
  );
}

export default ContaMatrizCard;

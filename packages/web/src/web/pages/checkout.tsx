import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  QrCode,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { AuthShell } from "../components/auth-shell";
import { AppIcon } from "../components/app-icon";
import { NeonButton, Pill } from "../components/ui/kit";
import { authClient } from "../lib/auth";
import { usePacotes } from "../queries/pacotes";
import {
  usePagarCheckout,
  useResumoCheckout,
  useStatusCheckout,
  type PedidoInput,
} from "../queries/checkout";

/**
 * CHECKOUT — pagamento dentro da plataforma.
 * Chega aqui vindo de qualquer botão de compra (plano, combo, montador,
 * Sala de Jogos, upgrade do painel). Gera o Pix, acompanha o pagamento e,
 * quando cai, o pacote é ativado sozinho e o cliente vai para o painel.
 */

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const slug = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const { data: session, isPending: sessaoCarregando } = authClient.useSession();
  const { data: pacotes } = usePacotes();

  const planoSlug = params.get("plano");
  const comboId = Number(params.get("combo") ?? 0) || null;
  const ciclo = params.get("ciclo") === "anual" ? "anual" : "mensal";
  const jogos = params.get("jogos") === "1";
  const apps = (params.get("apps") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  // o slug do pacote vira id assim que o catálogo chega
  const pacoteId = useMemo(() => {
    if (!planoSlug) return null;
    const numerico = Number(planoSlug);
    if (Number.isFinite(numerico) && numerico > 0) return numerico;
    const achado = (pacotes ?? []).find((p) => p.ativo && slug(p.nome) === planoSlug);
    return achado?.id ?? null;
  }, [planoSlug, pacotes]);

  const pedido: PedidoInput = { pacoteId, comboId, apps, ciclo, jogos };
  const pronto = Boolean(pacoteId || comboId || apps.length || jogos);
  const resumo = useResumoCheckout(pedido, pronto);

  const pagar = usePagarCheckout();
  const [txid, setTxid] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const status = useStatusCheckout(txid);
  const pago = status.data?.status === "pago";

  useEffect(() => {
    if (pagar.data?.txid) setTxid(pagar.data.txid);
  }, [pagar.data?.txid]);

  // pagamento confirmado: o pacote já foi ativado no servidor
  useEffect(() => {
    if (!pago) return;
    const t = window.setTimeout(() => navigate("/dashboard"), 2600);
    return () => window.clearTimeout(t);
  }, [pago, navigate]);

  const semSessao = !sessaoCarregando && !session;
  const destinoCadastro = `/signup?${params.toString()}&next=checkout`;

  return (
    <AuthShell
      accent="cyan"
      eyebrow="Pagamento seguro"
      title={
        <>
          Finalize sua assinatura{" "}
          <span className="text-neon-cyan glow-cyan">aqui mesmo</span>
        </>
      }
      subtitle="Pague por Pix na própria plataforma. A baixa é automática e os acessos aparecem no seu painel em segundos — sem depender de atendimento."
    >
      <div className="space-y-4">
        {/* ---------------- resumo do pedido ---------------- */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/35">
            Resumo do pedido
          </div>

          {!pronto && (
            <p className="mt-3 font-sans text-sm text-white/50">
              Nenhum item selecionado.{" "}
              <Link to="/#planos" className="text-neon-cyan underline-offset-2 hover:underline">
                Escolher um pacote
              </Link>
            </p>
          )}

          {pronto && resumo.isPending && (
            <p className="mt-3 inline-flex items-center gap-2 font-sans text-sm text-white/45">
              <Loader2 className="size-3.5 animate-spin" /> Calculando o valor…
            </p>
          )}

          {resumo.isError && (
            <p className="mt-3 inline-flex items-start gap-2 font-sans text-sm text-neon-red">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {resumo.error?.message ?? "Não foi possível montar este pedido."}
            </p>
          )}

          {resumo.data && (
            <>
              <h2 className="mt-2 font-display text-lg font-bold text-white">
                {resumo.data.titulo}
              </h2>

              {resumo.data.apps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resumo.data.apps.map((a) => (
                    <AppIcon key={a} id={a} size="xs" />
                  ))}
                </div>
              )}

              <ul className="mt-4 space-y-1.5 border-t border-dashed border-white/10 pt-3">
                {resumo.data.itens.map((i) => (
                  <li
                    key={i.rotulo}
                    className="flex items-center justify-between gap-3 font-sans text-[12.5px]"
                  >
                    <span className="text-white/50">{i.rotulo}</span>
                    <span className={i.valor < 0 ? "text-neon-cyan" : "text-white/70"}>
                      {i.valor < 0 ? `- ${brl(Math.abs(i.valor))}` : brl(i.valor)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
                <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-white/40">
                  Total / {resumo.data.periodo}
                </span>
                <span className="font-display text-3xl font-extrabold text-white">
                  {brl(resumo.data.valor)}
                </span>
              </div>

              {resumo.data.desconto > 0 && (
                <div className="mt-1 text-right font-sans text-[11px] text-neon-cyan">
                  você economiza {brl(resumo.data.desconto)} por {resumo.data.periodo}
                </div>
              )}
            </>
          )}
        </div>

        {/* ---------------- sem sessão ---------------- */}
        {semSessao && pronto && (
          <div className="rounded-2xl border border-neon-red/30 bg-neon-red/[0.07] p-5">
            <p className="font-sans text-[13px] leading-relaxed text-white/60">
              Crie sua conta (30 segundos) para gerar o Pix e receber os acessos no painel.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link to={destinoCadastro} className="flex-1">
                <NeonButton accent="red" size="md" className="w-full">
                  Criar conta e pagar
                  <ArrowRight className="size-4" />
                </NeonButton>
              </Link>
              <Link to={`/login?${params.toString()}&next=checkout`} className="flex-1">
                <NeonButton accent="cyan" variant="outline" size="md" className="w-full">
                  Já tenho conta
                </NeonButton>
              </Link>
            </div>
          </div>
        )}

        {/* ---------------- pagamento ---------------- */}
        {session && pronto && resumo.data && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-neon-cyan" />
                <span className="font-display text-sm font-bold text-white">Pagar com Pix</span>
              </div>
              {pago && (
                <Pill accent="cyan" icon={<ShieldCheck className="size-3" />}>
                  Pagamento confirmado
                </Pill>
              )}
            </div>

            {!pagar.data && (
              <NeonButton
                accent="cyan"
                size="lg"
                className="mt-4 w-full"
                data-testid="gerar-pix-checkout"
                disabled={pagar.isPending}
                onClick={() => pagar.mutate(pedido)}
              >
                {pagar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <QrCode className="size-4" />
                )}
                Gerar Pix de {brl(resumo.data.valor)}
              </NeonButton>
            )}

            {pagar.isError && (
              <p className="mt-3 font-sans text-xs text-neon-red">{pagar.error?.message}</p>
            )}

            {pagar.data && (
              <div className="mt-4">
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="font-sans text-[10px] uppercase tracking-wider text-white/35">
                    Pix copia e cola
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-white/70">
                    {pagar.data.copiaECola}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(pagar.data?.copiaECola ?? "");
                    setCopiado(true);
                    window.setTimeout(() => setCopiado(false), 1800);
                  }}
                  className="mt-3 w-full rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2.5 font-sans text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20"
                >
                  {copiado ? (
                    <Check className="mr-1 inline size-3.5" />
                  ) : (
                    <Copy className="mr-1 inline size-3.5" />
                  )}
                  {copiado ? "Código copiado" : "Copiar código Pix"}
                </button>

                <p className="mt-3 font-sans text-[11px] leading-relaxed text-white/35">
                  {pago
                    ? "Pagamento confirmado! Estamos liberando seus acessos e abrindo seu painel…"
                    : "Assim que o pagamento cair, esta tela atualiza sozinha e o pacote é ativado automaticamente."}
                </p>

                {pago && (
                  <Link to="/dashboard" className="mt-3 block">
                    <NeonButton accent="cyan" size="md" className="w-full">
                      Ir para meu painel
                      <ArrowRight className="size-4" />
                    </NeonButton>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
}

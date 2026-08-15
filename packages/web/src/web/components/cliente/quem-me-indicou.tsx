import { useState } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { useRegistrarIndicacao } from "../../queries/recompensas";

/**
 * QUEM ME INDICOU
 * ------------------------------------------------------------------
 * O link `/signup?ref=CODIGO` já vincula quem se cadastra por ele. Só que na
 * prática muita gente recebe o código solto (WhatsApp, print, boca a boca) e
 * se cadastra direto pelo site — ficando sem vínculo nenhum.
 *
 * Este bloco é a segunda porta: o cliente logado digita o código depois e o
 * vínculo é criado. Some da tela assim que o padrinho existe, e o servidor
 * nunca deixa trocar de padrinho (`registrarIndicacao` ignora se já vinculado).
 */
export function QuemMeIndicou({ padrinho }: { padrinho: { nome: string } | null }) {
  const registrar = useRegistrarIndicacao();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (padrinho) {
    return (
      <GlassCard accent="purple" className="p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-neon-purple" />
          <span className="font-display text-sm font-bold text-white">Quem te indicou</span>
        </div>
        <p className="mt-1.5 font-sans text-xs text-white/45">
          Sua conta está vinculada à indicação de{" "}
          <strong className="font-semibold text-white/80">{padrinho.nome}</strong>. O vínculo é
          único e não muda.
        </p>
      </GlassCard>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    const valor = codigo.trim().toUpperCase();
    if (valor.length < 3) {
      setErro("Digite o código completo.");
      return;
    }
    try {
      const r = await registrar.mutateAsync({ codigo: valor });
      if (r.ok) {
        setOk(r.padrinho ? `Pronto! Você entrou na rede de ${r.padrinho}.` : "Indicação registrada.");
        setCodigo("");
      } else {
        setErro("Código não encontrado. Confira com quem te indicou.");
      }
    } catch {
      setErro("Não foi possível registrar agora. Tente de novo em instantes.");
    }
  }

  return (
    <GlassCard accent="purple" className="p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-neon-purple" />
        <span className="font-display text-sm font-bold text-white">
          Alguém te indicou? Informe o código
        </span>
      </div>
      <p className="mt-1.5 font-sans text-xs text-white/45">
        Se você recebeu o código de um cliente e não usou o link dele no cadastro, digite aqui. Vale
        uma vez só e não pode ser trocado depois.
      </p>
      <form onSubmit={enviar} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))}
          placeholder="Ex.: DIEGO4K2"
          maxLength={24}
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Código de indicação de quem te indicou"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm uppercase text-white placeholder:font-sans placeholder:text-white/25 focus:border-neon-purple/50 focus:outline-none"
        />
        <NeonButton accent="purple" type="submit" disabled={registrar.isPending}>
          {registrar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Vincular
        </NeonButton>
      </form>
      {erro && <p className="mt-2 font-sans text-[11px] text-neon-red">{erro}</p>}
      {ok && <p className="mt-2 font-sans text-[11px] text-neon-cyan">{ok}</p>}
    </GlassCard>
  );
}

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { authClient } from "../../lib/auth";
import { CampoSenha } from "../ui/campo-senha";

/**
 * SEGURANÇA DA CONTA (cliente).
 * Troca de senha pelo Better Auth. Duas travas antes de disparar: senha nova
 * com no mínimo 8 caracteres e confirmação igual. A alteração revoga as outras
 * sessões, então pedimos uma confirmação explícita antes de enviar.
 */

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-sans text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1";

export function AlterarSenhaView({
  /** true quando a conta foi criada pelo ADM e a troca e obrigatoria */
  obrigatorio = false,
  onTrocada,
}: {
  obrigatorio?: boolean;
  onTrocada?: () => void;
} = {}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ atual: "", nova: "", confirmacao: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.nova.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (form.nova !== form.confirmacao) {
      setError("As senhas não coincidem.");
      return;
    }
    setConfirmando(true);
  }

  async function handleConfirmar() {
    setConfirmando(false);
    setLoading(true);
    try {
      const { error: authError } = await authClient.changePassword({
        newPassword: form.nova,
        currentPassword: form.atual,
        revokeOtherSessions: true,
      });
      if (authError) throw new Error(authError.message || "Erro ao alterar senha.");
      setSuccess(true);
      setForm({ atual: "", nova: "", confirmacao: "" });
      onTrocada?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <GlassCard accent="cyan" className="flex flex-col items-center p-8 text-center sm:p-12">
        <div className="flex size-20 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/30">
          <CheckCircle2 className="size-10" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-bold text-white">Senha atualizada!</h2>
        <p className="mt-2 max-w-xs font-sans text-sm text-white/50">
          Sua senha foi alterada com sucesso. Por segurança, todas as outras sessões foram
          encerradas.
        </p>
        {!obrigatorio && (
          <NeonButton accent="cyan" className="mt-8 min-w-[200px]" onClick={() => setSuccess(false)}>
            Entendido
          </NeonButton>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="mb-6 font-sans text-sm text-white/45">
        Mantenha sua conta protegida alterando sua senha regularmente. Ao confirmar, as sessões
        abertas em outros dispositivos são encerradas.
      </p>

      <GlassCard className="overflow-hidden p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-white/40">
              <Lock className="size-3" />
              Senha atual
            </label>
            <CampoSenha
              value={form.atual}
              onChange={(v) => setForm({ ...form, atual: v })}
              required
              autoComplete="current-password"
              className={`${inputBase} focus:border-neon-red/50 focus:ring-neon-red/50`}
              placeholder="Digite sua senha atual"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-white/40">
                <ShieldCheck className="size-3" />
                Nova senha
              </label>
              <CampoSenha
                value={form.nova}
                onChange={(v) => setForm({ ...form, nova: v })}
                required
                autoComplete="new-password"
                className={`${inputBase} focus:border-neon-cyan/50 focus:ring-neon-cyan/50`}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-white/40">
                <ShieldCheck className="size-3" />
                Confirmar nova senha
              </label>
              <CampoSenha
                value={form.confirmacao}
                onChange={(v) => setForm({ ...form, confirmacao: v })}
                required
                autoComplete="new-password"
                className={`${inputBase} focus:border-neon-cyan/50 focus:ring-neon-cyan/50`}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 font-sans text-xs font-medium text-neon-red">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {confirmando ? (
            <div className="rounded-2xl border border-neon-red/30 bg-neon-red/[0.07] p-5">
              <p className="font-display text-sm font-bold text-white">Confirmar alteração?</p>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-white/55">
                Isso altera sua senha de acesso e encerra todas as outras sessões ativas por
                segurança.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <NeonButton
                  type="button"
                  accent="red"
                  size="sm"
                  onClick={() => void handleConfirmar()}
                >
                  Confirmar alteração
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </NeonButton>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <NeonButton type="submit" disabled={loading} accent="red" className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Atualizando…
                  </>
                ) : (
                  "Alterar senha agora"
                )}
              </NeonButton>
            </div>
          )}

          <p className="text-center font-sans text-[10px] leading-relaxed text-white/30">
            Dica: use uma combinação de letras, números e símbolos para uma senha mais forte.
            <br />
            Ao alterar a senha, você precisará fazer login novamente nos outros dispositivos.
          </p>
        </form>
      </GlassCard>
    </div>
  );
}

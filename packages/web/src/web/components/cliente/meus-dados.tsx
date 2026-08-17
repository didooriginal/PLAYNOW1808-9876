import { useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, Save, User } from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { useAtualizarMeuPerfil } from "../../queries/usuarios";
import { client } from "../../lib/api";

/**
 * MEUS DADOS (cliente).
 * O cliente edita SÓ o que é dele: contato, endereço e foto. Nome, e-mail,
 * pacote, valor e vencimento continuam sendo do administrador — mostrados
 * aqui apenas para conferência.
 */

const input =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-sans text-sm text-white placeholder:text-white/20 focus:border-neon-cyan/50 focus:outline-none";

const rotulo =
  "font-sans text-[11px] font-semibold uppercase tracking-wider text-white/40";

type Cliente = {
  nome: string;
  email: string;
  telefone: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  avatarUrl?: string | null;
};

export function MeusDados({ cliente }: { cliente: Cliente }) {
  const salvar = useAtualizarMeuPerfil();
  const [form, setForm] = useState({
    telefone: cliente.telefone ?? "",
    endereco: cliente.endereco ?? "",
    cidade: cliente.cidade ?? "",
    estado: cliente.estado ?? "",
    cep: cliente.cep ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState(cliente.avatarUrl ?? "");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSalvo(false);
  };

  async function enviarFoto(arquivo: File) {
    setErro(null);
    setEnviandoFoto(true);
    try {
      const { url, publicUrl } = await client.upload.avatar({
        contentType: arquivo.type as "image/jpeg" | "image/png" | "image/webp",
        tamanho: arquivo.size,
      });
      const resposta = await fetch(url, {
        method: "PUT",
        body: arquivo,
        headers: { "Content-Type": arquivo.type },
      });
      if (!resposta.ok) throw new Error("Falha ao enviar a imagem.");
      await salvar.mutateAsync({ avatarUrl: publicUrl });
      setAvatarUrl(publicUrl);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Sua foto de perfil" className="size-full object-cover" />
              ) : (
                <User className="size-8 text-white/25" />
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-[#0b0b0f] text-white/70 transition-colors hover:text-white">
              {enviandoFoto ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Enviar foto de perfil"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void enviarFoto(arquivo);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-white">{cliente.nome}</p>
            <p className="truncate font-sans text-sm text-white/45">{cliente.email}</p>
            <p className="mt-1 font-sans text-[11px] text-white/30">
              Nome e e-mail são alterados pelo suporte. JPG, PNG ou WEBP de até 5 MB.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={rotulo} htmlFor="perfil-telefone">
              Telefone / WhatsApp
            </label>
            <input
              id="perfil-telefone"
              className={input}
              placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={set("telefone")}
            />
          </div>
          <div className="space-y-2">
            <label className={rotulo} htmlFor="perfil-cep">
              CEP
            </label>
            <input
              id="perfil-cep"
              className={input}
              placeholder="00000-000"
              value={form.cep}
              onChange={set("cep")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className={rotulo} htmlFor="perfil-endereco">
              Endereço
            </label>
            <input
              id="perfil-endereco"
              className={input}
              placeholder="Rua, número e complemento"
              value={form.endereco}
              onChange={set("endereco")}
            />
          </div>
          <div className="space-y-2">
            <label className={rotulo} htmlFor="perfil-cidade">
              Cidade
            </label>
            <input
              id="perfil-cidade"
              className={input}
              placeholder="Sua cidade"
              value={form.cidade}
              onChange={set("cidade")}
            />
          </div>
          <div className="space-y-2">
            <label className={rotulo} htmlFor="perfil-estado">
              Estado
            </label>
            <input
              id="perfil-estado"
              className={input}
              placeholder="SP"
              value={form.estado}
              onChange={set("estado")}
            />
          </div>
        </div>

        {erro && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-neon-red/30 bg-neon-red/10 p-4 font-sans text-xs font-medium text-neon-red">
            <AlertCircle className="size-4 shrink-0" />
            {erro}
          </div>
        )}

        {salvo && !erro && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 font-sans text-xs font-medium text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            Dados atualizados.
          </div>
        )}

        <NeonButton
          accent="cyan"
          className="mt-6"
          disabled={salvar.isPending}
          onClick={() => {
            setErro(null);
            salvar.mutate(
              {
                telefone: form.telefone.trim() || null,
                endereco: form.endereco.trim() || null,
                cidade: form.cidade.trim() || null,
                estado: form.estado.trim() || null,
                cep: form.cep.trim() || null,
              },
              {
                onSuccess: () => setSalvo(true),
                onError: (e) =>
                  setErro(e instanceof Error ? e.message : "Não foi possível salvar."),
              },
            );
          }}
        >
          {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar meus dados
        </NeonButton>
      </GlassCard>
    </div>
  );
}

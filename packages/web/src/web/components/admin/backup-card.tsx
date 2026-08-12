import { useState } from "react";
import { Check, Database, Download, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";
import { GlassCard, NeonButton } from "../ui/kit";
import { Ajuda, TituloSecao } from "../ui/tooltip";

/**
 * BACKUP DO BANCO EM EXCEL.
 *
 * O download NÃO é um `<a href>` simples de propósito: a rota exige sessão de
 * admin e pode responder 401/403/500 em JSON. Num link comum o navegador abriria
 * o JSON de erro numa aba e o admin ficaria sem entender o que aconteceu. Aqui a
 * resposta é lida via fetch, o erro vira mensagem na tela e o arquivo só é
 * salvo quando realmente veio a planilha.
 *
 * As senhas das contas matrizes são opt-in (`?senhas=1`): uma planilha vazada
 * com elas dá acesso a todos os streamings da operação.
 */

type Estado = "parado" | "gerando" | "pronto" | "erro";

export function BackupCard() {
  const [incluirSenhas, setIncluirSenhas] = useState(false);
  const [estado, setEstado] = useState<Estado>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);

  async function baixar() {
    setEstado("gerando");
    setErro(null);

    try {
      const resposta = await fetch(`/api/admin/backup.xlsx${incluirSenhas ? "?senhas=1" : ""}`, {
        credentials: "include",
      });

      if (!resposta.ok) {
        /** a rota devolve { erro } em JSON quando nega ou falha */
        let mensagem = `Falhou com status ${resposta.status}`;
        try {
          const corpo = (await resposta.json()) as { erro?: string };
          if (corpo?.erro) mensagem = corpo.erro;
        } catch {
          /* resposta sem JSON: mantém a mensagem de status */
        }
        throw new Error(mensagem);
      }

      /** nome sugerido pelo servidor (Content-Disposition), com fallback */
      const disposicao = resposta.headers.get("Content-Disposition") ?? "";
      const achado = /filename="?([^";]+)"?/i.exec(disposicao);
      const nome =
        achado?.[1] ??
        `playplusnow-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setArquivo(nome);
      setEstado("pronto");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEstado("erro");
    }
  }

  return (
    <GlassCard className="p-5">
      <TituloSecao ajuda="backup.baixar">Backup do banco em Excel</TituloSecao>

      <p className="mt-2 max-w-2xl font-sans text-xs leading-relaxed text-white/40">
        Gera um arquivo <span className="text-white/60">.xlsx</span> com uma aba por tabela —
        clientes, contas matrizes, pacotes, faturas, cobranças Pix, gift cards, comissões — mais uma
        aba de resumo com a contagem de registros. Guarde fora do servidor: é a sua cópia de
        segurança e a prova dos números em caso de disputa.
      </p>

      <label className="mt-4 flex w-fit cursor-pointer items-start gap-2.5 rounded-2xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
        <input
          type="checkbox"
          checked={incluirSenhas}
          onChange={(e) => {
            setIncluirSenhas(e.target.checked);
            if (estado === "pronto" || estado === "erro") setEstado("parado");
          }}
          className="mt-0.5 size-4 accent-[#ff1f3d]"
        />
        <span className="font-sans text-xs text-white/70">
          <span className="flex items-center gap-1.5 font-semibold text-white/85">
            Incluir as senhas das contas matrizes
            <Ajuda ajuda="backup.senhas" />
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-300/80">
            <ShieldAlert className="size-3.5 shrink-0" />
            Sem isso a coluna sai em branco. Com isso, quem abrir a planilha entra nos streamings.
          </span>
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <NeonButton accent="cyan" onClick={baixar} disabled={estado === "gerando"}>
          {estado === "gerando" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {estado === "gerando" ? "Gerando planilha…" : "Baixar backup (.xlsx)"}
        </NeonButton>

        <span className="flex items-center gap-1.5 font-sans text-[11px] text-white/35">
          <Database className="size-3.5" />
          lido direto do banco, sempre atualizado
        </span>
      </div>

      {estado === "pronto" && arquivo && (
        <p
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 font-sans text-xs text-emerald-300"
        >
          <Check className="size-3.5" strokeWidth={3} />
          Baixado: <span className="text-white/70">{arquivo}</span>
        </p>
      )}

      {estado === "erro" && (
        <p
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 font-sans text-xs text-neon-red"
        >
          <TriangleAlert className="size-3.5" />
          Não foi possível gerar o backup: {erro}
        </p>
      )}
    </GlassCard>
  );
}

export default BackupCard;

import { useMemo } from "react";
import { useCatalogoOpcoes } from "../../queries/planos-apps";

/**
 * SELETOR DE SERVIÇO VENDIDO (slug de app OU slug de opção).
 *
 * `contas_matrizes.servico` guarda o slug que é vendido: pode ser o slug do
 * app (netflix) ou o slug de uma variação (globoplay-premium-telecine).
 * Digitar à mão gerava matrizes órfãs, então todo formulário de conta usa
 * este select, alimentado pelo catálogo real.
 */

export type OpcaoServico = {
  /** slug vendável */
  slug: string;
  /** nome legível completo: "Globoplay · Premium + Telecine" */
  nome: string;
  /** slug do aplicativo dono (para filtros por app) */
  appSlug: string;
  /** nome do aplicativo dono */
  appNome: string;
};

/** lista achatada de todos os slugs vendáveis do catálogo */
export function useOpcoesServico() {
  const catalogo = useCatalogoOpcoes();

  return useMemo(() => {
    const apps = catalogo.data ?? [];
    const opcoes: OpcaoServico[] = [];

    for (const app of apps) {
      const ativas = (app.opcoes ?? []).filter((o) => o.ativo);
      if (!ativas.length) {
        opcoes.push({
          slug: app.slug,
          nome: app.nome,
          appSlug: app.slug,
          appNome: app.nome,
        });
        continue;
      }
      // o slug puro do app continua vendável (matrizes antigas usam ele)
      opcoes.push({
        slug: app.slug,
        nome: `${app.nome} · qualquer opção`,
        appSlug: app.slug,
        appNome: app.nome,
      });
      for (const opcao of ativas) {
        opcoes.push({
          slug: opcao.slug,
          nome: `${app.nome} · ${opcao.nome}`,
          appSlug: app.slug,
          appNome: app.nome,
        });
      }
    }

    const porSlug = new Map(opcoes.map((o) => [o.slug, o]));
    return {
      carregando: catalogo.isLoading,
      apps,
      opcoes,
      porSlug,
      /** nome legível de um slug; devolve o próprio slug quando é desconhecido */
      nomeDe: (slug: string) => porSlug.get(slug)?.nome ?? slug,
    };
  }, [catalogo.data, catalogo.isLoading]);
}

export function SelectServico({
  id,
  value,
  onChange,
  className,
  incluirVazio,
}: {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  className?: string;
  /** primeira opção em branco (usado nos filtros) */
  incluirVazio?: string;
}) {
  const { apps, porSlug } = useOpcoesServico();
  const desconhecido = value && !porSlug.has(value) ? value : null;

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {incluirVazio ? (
        <option value="" className="bg-[#09090b]">
          {incluirVazio}
        </option>
      ) : null}
      {desconhecido ? (
        <option value={desconhecido} className="bg-[#09090b]">
          {desconhecido} (fora do catálogo)
        </option>
      ) : null}
      {apps.map((app) => {
        const ativas = (app.opcoes ?? []).filter((o) => o.ativo);
        if (!ativas.length) {
          return (
            <option key={app.slug} value={app.slug} className="bg-[#09090b]">
              {app.nome}
            </option>
          );
        }
        return (
          <optgroup key={app.slug} label={app.nome}>
            <option value={app.slug} className="bg-[#09090b]">
              {app.nome} · qualquer opção
            </option>
            {ativas.map((o) => (
              <option key={o.slug} value={o.slug} className="bg-[#09090b]">
                {app.nome} · {o.nome}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

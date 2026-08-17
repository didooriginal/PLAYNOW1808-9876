import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * CampoSenha — input de senha com botao "olho" (mostrar/ocultar) e, quando
 * `copiavel`, um botao de copiar ao lado. Usado em login, cadastro, troca de
 * senha do cliente e em todos os formularios de conta matriz do admin, onde o
 * ADM precisa conferir e copiar a senha que vai repassar ao cliente.
 *
 * O botao usa `aria-label` + `aria-pressed` (nunca `title=`), seguindo o
 * padrao de acessibilidade do projeto.
 */
export function CampoSenha({
  id,
  value,
  onChange,
  className = "",
  placeholder,
  autoComplete,
  required,
  copiavel = false,
  disabled,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  copiavel?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const botoes = copiavel ? 2 : 1;
  const padding = botoes === 2 ? "pr-20" : "pr-12";

  async function copiar() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* clipboard indisponivel — ignora silenciosamente */
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type={visivel ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        data-testid={testId}
        className={`${className} ${padding}`}
      />
      <div className="absolute inset-y-0 right-0 flex items-center">
        {copiavel && (
          <button
            type="button"
            onClick={copiar}
            aria-label={copiado ? "Senha copiada" : "Copiar senha"}
            className="flex w-9 items-center justify-center text-white/35 transition-colors hover:text-white/70"
          >
            {copiado ? (
              <Check className="size-4 text-neon-cyan" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="flex w-11 items-center justify-center text-white/35 transition-colors hover:text-white/70"
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

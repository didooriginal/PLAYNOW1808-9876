import { GlassCard, NeonButton } from "../components/ui/kit";
import { FileText, AlertTriangle, CheckCircle, Ban, ArrowLeft } from "lucide-react";
import { Link } from "wouter";



function Termos() {
  return (
    <div className="min-h-screen bg-black/95 py-24 px-4 sm:px-6 relative">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <NeonButton size="sm" variant="outline" accent="red" className="gap-2">
              <ArrowLeft className="size-4" />
              Voltar para o início
            </NeonButton>
          </Link>
        </div>

        <div className="mb-12 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neon-red shadow-lg shadow-red-500/10 mb-6">
            <FileText className="size-8" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white sm:text-5xl">
            Termos de <span className="text-neon-red glow-red">Uso</span>
          </h1>
          <p className="mt-4 text-white/50 font-sans">
            Regras de utilização da plataforma PLAYPLUSNOW
          </p>
        </div>

        <div className="space-y-8">
          <GlassCard className="p-8 sm:p-10 border-l-4 border-l-neon-red">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="size-6 text-neon-red" />
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Regras de Ouro</h2>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-3 text-neon-cyan">
                  <CheckCircle className="size-4" />
                  <span className="font-bold text-xs uppercase">Dispositivos</span>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">
                  É permitido o cadastro de até <strong>2 aparelhos</strong> por cliente. O uso simultâneo é restrito a <strong>1 tela por aplicativo</strong>.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
                <div className="flex items-center gap-2 mb-3 text-neon-red">
                  <Ban className="size-4" />
                  <span className="font-bold text-xs uppercase">Proibido</span>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">
                  Proibida a criação de perfis, alteração de senhas ou compartilhamento de acessos com terceiros.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-8">
            <h2 className="text-xl font-bold text-white mb-4">1. Ativação e Acessos</h2>
            <p className="text-white/60 leading-relaxed mb-6">
              Os acessos são liberados automaticamente após a confirmação do pagamento via PIX ou Cartão. A validade do plano é de 30 dias, renováveis mediante novo pagamento.
            </p>

            <h2 className="text-xl font-bold text-white mb-4">2. Política de Banimento</h2>
            <p className="text-white/60 leading-relaxed mb-4">
              O descumprimento de qualquer regra (como compartilhamento de senha ou tentativa de mudar dados da conta matriz) resultará em <strong>banimento imediato e permanente</strong>, sem direito a reembolso.
            </p>
            <p className="text-white/60 leading-relaxed">
              O sistema monitora logs de IP e dispositivos. Atividades suspeitas são bloqueadas preventivamente.
            </p>
          </GlassCard>

          <GlassCard className="p-8">
            <h2 className="text-xl font-bold text-white mb-4">3. Natureza do Serviço</h2>
            <p className="text-white/60 leading-relaxed">
              A PLAYPLUSNOW atua como uma plataforma de gestão de custos compartilhados. Não somos os detentores das marcas de streaming exibidas. Todos os logotipos são propriedades de seus respectivos donos.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default Termos;

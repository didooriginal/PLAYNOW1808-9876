import { GlassCard, NeonButton } from "../components/ui/kit";
import { ShieldCheck, Lock, Eye, FileText, ArrowLeft } from "lucide-react";
import { Link } from "wouter";



function Privacidade() {
  return (
    <div className="min-h-screen bg-black/95 py-24 px-4 sm:px-6 relative">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link href="/">
            <NeonButton size="sm" variant="outline" accent="cyan" className="gap-2">
              <ArrowLeft className="size-4" />
              Voltar para o início
            </NeonButton>
          </Link>
        </div>

        <div className="mb-12 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neon-cyan shadow-lg shadow-cyan-500/10 mb-6">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white sm:text-5xl">
            Política de <span className="text-neon-cyan glow-cyan">Privacidade</span>
          </h1>
          <p className="mt-4 text-white/50 font-sans">
            Última atualização: 13 de agosto de 2026
          </p>
        </div>

        <div className="space-y-8">
          <GlassCard className="p-8 sm:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="size-10 shrink-0 flex items-center justify-center rounded-lg bg-cyan-500/10 text-neon-cyan">
                <Eye className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Coleta de Informações</h2>
                <p className="text-white/60 leading-relaxed">
                  Coletamos informações básicas necessárias para a prestação de nossos serviços, como nome, WhatsApp e modelo de aparelhos utilizados. Esses dados são utilizados exclusivamente para gerenciar sua conta e garantir o acesso aos streamings contratados.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 mb-6">
              <div className="size-10 shrink-0 flex items-center justify-center rounded-lg bg-purple-500/10 text-neon-purple">
                <Lock className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Segurança dos Dados</h2>
                <p className="text-white/60 leading-relaxed">
                  Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração. Seus dados de pagamento são processados através do Mercado Pago, garantindo criptografia de ponta a ponta.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="size-10 shrink-0 flex items-center justify-center rounded-lg bg-red-500/10 text-neon-red">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Compartilhamento</h2>
                <p className="text-white/60 leading-relaxed">
                  Não vendemos ou compartilhamos suas informações pessoais com terceiros para fins de marketing. O compartilhamento ocorre apenas quando necessário para o processamento de pagamentos ou cumprimento de obrigações legais.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-8">
            <h2 className="text-xl font-bold text-white mb-4">Seus Direitos</h2>
            <p className="text-white/60 leading-relaxed mb-4">
              Você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento através da nossa Central de Ajuda ou entrando em contato via WhatsApp.
            </p>
            <p className="text-white/60 leading-relaxed">
              Ao utilizar a PLAYPLUSNOW, você concorda com os termos descritos nesta política. Recomendamos a leitura periódica deste documento, pois ele pode ser atualizado para refletir melhorias em nossos processos.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default Privacidade;

import { layoutEmail } from "../../services/email";

/**
 * TEMPLATES DE E-MAIL TRANSACIONAIS - PLAYPLUSNOW
 * Design minimalista e profissional, alinhado à marca.
 */

export const templates = {
  /** 1. Entrega de Acesso (Pós-Pagamento) */
  entregaAcesso: (dados: { nome: string; email: string; linkPainel: string }) => ({
    assunto: "Seu acesso à PLAYPLUSNOW chegou! 🚀",
    texto: `Olá, ${dados.nome}! Seu pagamento foi aprovado e seu acesso está liberado.\n\nLogin: ${dados.email}\nSenha: A que você cadastrou no site.\n\nLink de Acesso: ${dados.linkPainel}`,
    html: layoutEmail({
      titulo: "Bem-vindo à PLAYPLUSNOW!",
      corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Seu pagamento foi confirmado e sua conta já está ativa. Prepare a pipoca, seus serviços de streaming já estão disponíveis no painel.</p>
        <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin:20px 0;">
          <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;">DADOS DE ACESSO:</p>
          <p style="margin:0; color:#ffffff;"><strong>Login:</strong> ${dados.email}</p>
          <p style="margin:0; color:#ffffff;"><strong>Senha:</strong> A senha que você definiu no cadastro.</p>
        </div>
      `,
      botao: { texto: "Acessar meu Painel", url: dados.linkPainel },
      rodape: "Dica: Caso não lembre sua senha, use a opção 'Esqueci minha senha' na tela de login."
    })
  }),

  /** 2. Confirmação de Renovação (Assinatura Recorrente) */
  confirmacaoRenovacao: (dados: { nome: string; valor: string; validade: string }) => ({
    assunto: "Sua renovação foi confirmada! 💎",
    texto: `Olá, ${dados.nome}! Sua assinatura foi renovada com sucesso.\nValor: ${dados.valor}\nVálido até: ${dados.validade}\nObrigado por continuar conosco!`,
    html: layoutEmail({
      titulo: "Assinatura Renovada",
      corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Passando para avisar que sua renovação automática foi processada com sucesso. Obrigado por continuar com a gente!</p>
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <tr>
            <td style="padding:8px 0; color:#94a3b8;">Valor processado:</td>
            <td style="padding:8px 0; color:#ffffff; text-align:right;"><strong>${dados.valor}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#94a3b8;">Novo vencimento:</td>
            <td style="padding:8px 0; color:#ffffff; text-align:right;"><strong>${dados.validade}</strong></td>
          </tr>
        </table>
      `,
      botao: { texto: "Ver Assinatura", url: "https://playplusnow.com.br/dashboard" },
      rodape: "O acesso continua liberado em todos os seus dispositivos."
    })
  }),

  /** 3. Aviso de Vencimento (Lembrete 3 dias antes) */
  avisoVencimento: (dados: { nome: string; dias: number; valor: string; linkPagamento: string }) => ({
    assunto: `Atenção: Sua assinatura vence em ${dados.dias} dias ⚠️`,
    texto: `Olá, ${dados.nome}! Notamos que sua assinatura vence em breve.\nValor para renovação: ${dados.valor}\nEvite o bloqueio automático renovando agora pelo link: ${dados.linkPagamento}`,
    html: layoutEmail({
      titulo: "Sua assinatura está vencendo",
      corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Faltam apenas <strong>${dados.dias} dias</strong> para o vencimento do seu plano atual. Não deixe para a última hora e evite interrupções no seu acesso.</p>
        <p style="color:#cbd5e1;">Valor da renovação: <strong>${dados.valor}</strong></p>
      `,
      botao: { texto: "Renovar Agora", url: dados.linkPagamento },
      rodape: "Se você já realizou o pagamento, por favor ignore este aviso."
    })
  }),

  /**
   * 4. Boas-vindas (disparado no CADASTRO, antes do pagamento).
   * Não promete acesso liberado — o acesso só chega depois do Pix confirmado,
   * que é quando sai o template `entregaAcesso`.
   */
  boasVindas: (dados: { nome: string; email: string; linkPainel: string }) => ({
    assunto: "Sua conta PLAYPLUSNOW foi criada 🎬",
    texto: [
      `Olá, ${dados.nome}!`,
      "",
      "Sua conta na PLAYPLUSNOW foi criada com sucesso.",
      `Login: ${dados.email}`,
      "",
      "O próximo passo é confirmar o pagamento no painel. Assim que o Pix cair, seus acessos são liberados automaticamente.",
      "",
      `Painel: ${dados.linkPainel}`,
    ].join("\n"),
    html: layoutEmail({
      titulo: "Conta criada com sucesso",
      corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Sua conta na PLAYPLUSNOW já existe. Falta só um passo: confirmar o pagamento no painel. Assim que o Pix for aprovado, seus acessos são liberados automaticamente e você recebe outro e-mail com os dados.</p>
        <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin:20px 0;">
          <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;">SEU LOGIN:</p>
          <p style="margin:0; color:#ffffff;"><strong>${dados.email}</strong></p>
        </div>
      `,
      botao: { texto: "Ir para o painel", url: dados.linkPainel },
      rodape: "Se não foi você que criou esta conta, é só ignorar este e-mail."
    })
  }),

  /**
   * 5. Fatura ATRASADA (o vencimento já passou).
   * `dias` = há quantos dias venceu. `diasParaBloqueio` = quantos ainda faltam
   * para a suspensão automática (0 quando o acesso já foi suspenso).
   */
  faturaAtrasada: (dados: {
    nome: string;
    dias: number;
    valor: string;
    vencimento: string;
    linkPagamento: string;
    diasParaBloqueio: number;
  }) => {
    const bloqueado = dados.diasParaBloqueio <= 0;
    const plural = dados.dias === 1 ? "1 dia" : `${dados.dias} dias`;
    const aviso = bloqueado
      ? "Seu acesso foi suspenso. Assim que o pagamento for confirmado, tudo volta automaticamente."
      : `Faltam ${dados.diasParaBloqueio === 1 ? "1 dia" : `${dados.diasParaBloqueio} dias`} para a suspensão automática do acesso.`;
    return {
      assunto: bloqueado
        ? "Seu acesso foi suspenso por falta de pagamento"
        : `Sua fatura venceu há ${plural} ⏰`,
      texto: [
        `Olá, ${dados.nome}!`,
        "",
        `Sua fatura de ${dados.valor} venceu em ${dados.vencimento} (há ${plural}) e ainda não identificamos o pagamento.`,
        aviso,
        "",
        `Pagar agora: ${dados.linkPagamento}`,
        "",
        "Se você já pagou nas últimas horas, pode ignorar este e-mail.",
      ].join("\n"),
      html: layoutEmail({
        titulo: bloqueado ? "Acesso suspenso" : "Sua fatura está atrasada",
        corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Sua fatura venceu em <strong>${dados.vencimento}</strong> (há ${plural}) e ainda não identificamos o pagamento.</p>
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <tr>
            <td style="padding:8px 0; color:#94a3b8;">Valor em aberto:</td>
            <td style="padding:8px 0; color:#ffffff; text-align:right;"><strong>${dados.valor}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#94a3b8;">Venceu em:</td>
            <td style="padding:8px 0; color:#ffffff; text-align:right;"><strong>${dados.vencimento}</strong></td>
          </tr>
        </table>
        <p style="color:${bloqueado ? "#ff6b74" : "#fbbf24"};"><strong>${aviso}</strong></p>
      `,
        botao: { texto: "Pagar agora", url: dados.linkPagamento },
        rodape: "Se você já realizou o pagamento nas últimas horas, ignore este aviso.",
      }),
    };
  },

  /**
   * 6. Cancelamento da recorrência no cartão.
   * O acesso NÃO cai na hora: vale até o fim do período já pago.
   */
  cancelamento: (dados: {
    nome: string;
    titulo: string;
    acessoAte: string;
    linkPainel: string;
  }) => ({
    assunto: "Sua assinatura foi cancelada",
    texto: [
      `Olá, ${dados.nome}!`,
      "",
      `Confirmamos o cancelamento da renovação automática${dados.titulo ? ` de ${dados.titulo}` : ""}.`,
      "Não haverá novas cobranças no seu cartão.",
      dados.acessoAte
        ? `Seu acesso continua liberado até ${dados.acessoAte}.`
        : "Seu acesso continua liberado até o fim do período já pago.",
      "",
      `Mudou de ideia? É só reativar pelo painel: ${dados.linkPainel}`,
    ].join("\n"),
    html: layoutEmail({
      titulo: "Assinatura cancelada",
      corpo: `
        <p>Olá, <strong>${dados.nome}</strong>!</p>
        <p>Confirmamos o cancelamento da renovação automática${dados.titulo ? ` de <strong>${dados.titulo}</strong>` : ""}. <strong>Não haverá novas cobranças</strong> no seu cartão.</p>
        <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin:20px 0;">
          <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;">SEU ACESSO CONTINUA ATÉ:</p>
          <p style="margin:0; color:#ffffff; font-size:18px;"><strong>${dados.acessoAte || "o fim do período já pago"}</strong></p>
        </div>
        <p>Sentimos muito em ver você indo embora. Se mudar de ideia, dá para reativar a qualquer momento pelo painel — os mesmos preços continuam valendo.</p>
      `,
      botao: { texto: "Reativar assinatura", url: dados.linkPainel },
      rodape: "Se você não pediu este cancelamento, fale com a gente o quanto antes.",
    }),
  }),
};

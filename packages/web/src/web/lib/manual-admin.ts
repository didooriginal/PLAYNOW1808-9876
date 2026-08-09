/**
 * MANUAL OPERACIONAL DO ADMIN — conteúdo do guia exibido na aba "Manual"
 * do painel administrativo (visível somente para `usuarios.admin`).
 *
 * O conteúdo é declarativo (dados, não JSX) para que a view possa filtrar,
 * indexar e buscar sem duplicar texto.
 */

export type Bloco =
  | { tipo: "texto"; texto: string }
  | { tipo: "passos"; titulo?: string; itens: string[] }
  | { tipo: "campos"; titulo?: string; itens: { termo: string; desc: string }[] }
  | { tipo: "aviso"; tom: "regra" | "atencao" | "dica"; texto: string }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] };

export type SecaoManual = {
  id: string;
  titulo: string;
  /** chave do ícone resolvida na view */
  icone:
    | "clientes"
    | "estoque"
    | "catalogo"
    | "codigos"
    | "gamificacao"
    | "suporte"
    | "faturas"
    | "inicio"
    | "regras";
  accent: "red" | "cyan" | "purple";
  /** onde a funcionalidade vive no painel */
  onde: string;
  resumo: string;
  blocos: Bloco[];
};

export const MANUAL_VERSAO = "1.0 · agosto/2026";

export const MANUAL: SecaoManual[] = [
  /* ---------------------------------------------------------------- */
  {
    id: "inicio",
    titulo: "Como o sistema pensa",
    icone: "inicio",
    accent: "cyan",
    onde: "Leitura obrigatória antes de operar",
    resumo:
      "Três princípios explicam 90% do comportamento do painel. Entendendo eles, nenhuma tela vira surpresa.",
    blocos: [
      {
        tipo: "campos",
        titulo: "Princípios da operação",
        itens: [
          {
            termo: "O banco é a única fonte de verdade",
            desc: "Nenhum número da tela é digitado à mão. Vagas ocupadas, faturamento, XP, nível e inadimplência são recalculados a partir dos registros reais (alocações, faturas, indicações). Se um número parece errado, o dado de origem é que está errado.",
          },
          {
            termo: "Nada é apagado, tudo é liberado",
            desc: "Ao tirar um cliente de uma conta matriz, a linha não é deletada: ela vira status \"liberado\" com motivo e data. A vaga volta ao estoque e o histórico continua auditável.",
          },
          {
            termo: "Ações são idempotentes",
            desc: "Rodar a mesma operação duas vezes não duplica nada. Faturas usam a chave cliente + competência e prêmios usam uma chave única de evento — reprocessar é seguro.",
          },
        ],
      },
      {
        tipo: "campos",
        titulo: "Vocabulário do painel",
        itens: [
          {
            termo: "Conta matriz",
            desc: "A assinatura real que a PLAPLUSNOW paga no serviço (ex.: uma conta Netflix). Tem e-mail, senha, um número total de vagas e uma data de vencimento.",
          },
          {
            termo: "Vaga / alocação",
            desc: "O vínculo entre um cliente e uma conta matriz. É o que faz as credenciais aparecerem no painel do cliente.",
          },
          {
            termo: "Aplicativo",
            desc: "Item do catálogo (Netflix, Spotify, Premiere...) com categoria e preço avulso. Alimenta pacotes, combos e contas matrizes.",
          },
          {
            termo: "Pacote",
            desc: "O que o cliente assina: nome, preço mensal e a lista de serviços incluídos.",
          },
          {
            termo: "Combo",
            desc: "Sugestão comercial montada no painel e exibida na landing e no painel do cliente, com preço promocional e economia calculada.",
          },
          {
            termo: "Código OTP",
            desc: "Código de verificação que o streaming envia por e-mail. Efêmero: vive 1 hora e não vira histórico.",
          },
        ],
      },
      {
        tipo: "aviso",
        tom: "dica",
        texto:
          "Rotina sugerida: abra a Visão Geral, resolva os badges vermelhos (suporte pendente, contas lotadas, faturas vencidas) e só depois vá para tarefas de cadastro. Os badges do menu lateral são a sua fila de trabalho.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "clientes",
    titulo: "Gestão de Clientes e Assinaturas",
    icone: "clientes",
    accent: "cyan",
    onde: "Menu › Clientes (e blocos de resumo na Visão Geral)",
    resumo:
      "Cadastro do assinante, pacote contratado, ciclo de cobrança e status de pagamento. É aqui que a assinatura nasce.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "A tabela de clientes lista toda a base com pacote, valor, ciclo, data de início e status de pagamento. A busca filtra por nome, e-mail ou telefone. Cada linha é a ficha operacional do assinante: dela saem as faturas, a jornada de XP e os acessos liberados.",
      },
      {
        tipo: "passos",
        titulo: "Cadastrar um novo cliente",
        itens: [
          "Menu › Clientes › formulário \"Novo cliente\".",
          "Preencha nome, e-mail e telefone (WhatsApp) — o e-mail é a chave de login e não pode repetir.",
          "Escolha o pacote: o valor mensal é puxado do pacote automaticamente.",
          "Defina o ciclo (mensal ou anual) e a data de início da assinatura — essa data governa o dia de vencimento de todas as faturas.",
          "Salve. O cliente já pode entrar com o e-mail cadastrado; o código de indicação dele é gerado no primeiro acesso.",
          "Vá em Gestão de Estoque e aloque o cliente nas contas matrizes dos serviços do pacote.",
        ],
      },
      {
        tipo: "campos",
        titulo: "Status de pagamento",
        itens: [
          {
            termo: "ativo",
            desc: "Em dia. Acessos liberados e jornada contando renovações normalmente.",
          },
          {
            termo: "a vencer",
            desc: "Fatura aberta com vencimento próximo. O cliente vê o alerta de vencimento no painel dele.",
          },
          {
            termo: "inadimplente",
            desc: "Fatura vencida. A última competência entra como \"vencido\" nas faturas e o cliente aparece no contador de pendências do menu.",
          },
        ],
      },
      {
        tipo: "aviso",
        tom: "atencao",
        texto:
          "Trocar o pacote de um cliente não move as vagas sozinho. Depois de mudar o pacote, libere as vagas dos serviços que saíram e aloque as dos que entraram (use o motivo \"troca de pacote\" para o histórico ficar legível).",
      },
      {
        tipo: "aviso",
        tom: "regra",
        texto:
          "Excluir um cliente é irreversível e derruba o vínculo dele com o histórico. Para pausar alguém, prefira liberar as vagas e marcar o pagamento — o cadastro fica preservado.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "estoque",
    titulo: "Contas Matrizes e Vagas",
    icone: "estoque",
    accent: "purple",
    onde: "Menu › Gestão de Estoque",
    resumo:
      "O coração da operação: quantas vagas você tem, quem está em cada uma, o que vence primeiro e como repor sem perder histórico.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "Cada card é uma conta matriz: serviço, e-mail, senha, lotação (vagas ocupadas / total) e data de vencimento. A lotação nunca é digitada — é contada a partir das alocações ativas. Se um cliente é liberado, o contador cai na hora.",
      },
      {
        tipo: "passos",
        titulo: "Cadastrar uma conta matriz",
        itens: [
          "Menu › Gestão de Estoque › \"Nova conta matriz\".",
          "Selecione o serviço (vem do Catálogo de Aplicativos) e informe e-mail e senha da conta.",
          "Defina o total de vagas conforme o plano contratado no serviço.",
          "Informe o vencimento da conta — o painel passa a alertar quando estiver perto.",
          "Salve: as vagas entram no estoque disponíveis para alocação.",
        ],
      },
      {
        tipo: "passos",
        titulo: "Alocar, liberar e repor",
        itens: [
          "Alocar: no card da conta, escolha o cliente no seletor e confirme. O seletor mostra apenas clientes que ainda não têm vaga ativa naquela conta.",
          "O painel bloqueia a alocação se a conta já estiver lotada — libere uma vaga ou aumente o total de vagas.",
          "Liberar: no cliente vinculado, use liberar e escolha o motivo (reposição, manual ou troca de pacote). A vaga volta ao estoque e a linha vira histórico.",
          "Repor: quando a conta matriz cai (senha trocada pelo serviço, conta suspensa), atualize e-mail/senha no card. Os clientes vinculados passam a ver as credenciais novas automaticamente.",
          "Editar vagas: o total de vagas é editável no card — útil quando o plano da conta muda de tamanho.",
        ],
      },
      {
        tipo: "campos",
        titulo: "Sinais do card",
        itens: [
          {
            termo: "Lotada",
            desc: "Vagas ocupadas = total. A conta aparece no badge do menu \"Gestão de Estoque\" — sinal de que é hora de comprar outra matriz.",
          },
          {
            termo: "Vence em X dias",
            desc: "Alerta de vencimento da conta matriz. Renove antes: uma matriz vencida derruba todos os clientes vinculados de uma vez.",
          },
          {
            termo: "Aguardando liberação",
            desc: "O cliente tem o serviço no pacote mas ainda não tem vaga. No painel dele aparece \"estamos preparando o seu acesso\" — resolva alocando.",
          },
        ],
      },
      {
        tipo: "aviso",
        tom: "regra",
        texto:
          "O cliente nunca vê quantas vagas a conta tem, nem quem divide a matriz com ele. Essa informação é exclusiva do painel administrativo — não repasse em atendimento.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "catalogo",
    titulo: "Catálogo de Produtos e Combos",
    icone: "catalogo",
    accent: "red",
    onde: "Menu › Aplicativos · Menu › Pacotes",
    resumo:
      "Aplicativos, preços avulsos, categorias, pacotes vendidos e combos promocionais que aparecem na landing e no painel do cliente.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "O Catálogo de Aplicativos é a base de tudo: o que existe aqui é o que pode ser vendido, montado em pacote, sugerido em combo e cadastrado como conta matriz. Cada app tem nome, categoria e preço avulso.",
      },
      {
        tipo: "campos",
        titulo: "Categorias disponíveis",
        itens: [
          { termo: "Streaming", desc: "Netflix, Disney+, Prime Video, Max, Globoplay e afins." },
          { termo: "Esportes", desc: "Premiere e combinações com Globoplay/Prime." },
          { termo: "Música", desc: "Spotify, Deezer, YouTube Premium." },
          { termo: "Produtividade", desc: "Ferramentas e assinaturas utilitárias." },
          { termo: "IPTV", desc: "Claro TV+, Sky, UniTV e similares." },
          { termo: "Asiático", desc: "KOCOWA+ e catálogos de dorama." },
        ],
      },
      {
        tipo: "passos",
        titulo: "Manter o catálogo",
        itens: [
          "Menu › Aplicativos › \"Novo aplicativo\": nome, categoria e preço avulso.",
          "Para reajustar preço, edite o valor direto no card (edição inline) — salva no banco e reflete na hora na landing, no montador e no painel do cliente.",
          "A categoria define em qual filtro o app aparece no montador da landing (Todos · Streaming · Esportes · Música · Produtividade · IPTV · Asiático).",
          "Remover um app do catálogo não apaga contas matrizes existentes; revise pacotes e combos que o citavam.",
        ],
      },
      {
        tipo: "passos",
        titulo: "Pacotes (o que o cliente assina)",
        itens: [
          "Menu › Pacotes › \"Novo pacote\": nome, preço mensal e serviços incluídos.",
          "O preço do pacote é o que vira valor da assinatura do cliente e, portanto, o valor das faturas.",
          "A economia mostrada ao cliente é calculada comparando o preço do pacote com a soma dos preços avulsos dos serviços — mantenha os avulsos corretos para a economia fazer sentido.",
        ],
      },
      {
        tipo: "passos",
        titulo: "Combo Inteligente",
        itens: [
          "Monte no builder de combos: nome, chamada curta, preço promocional e apps que compõem o combo.",
          "O sistema calcula sozinho a soma dos avulsos e o percentual de economia exibido.",
          "Combos publicados aparecem na vitrine da landing e como sugestão no painel do cliente (upsell).",
          "Combos são material comercial: criar, editar ou remover não altera nenhuma assinatura ativa.",
        ],
      },
      {
        tipo: "aviso",
        tom: "dica",
        texto:
          "Antes de anunciar promoção, confira o preço avulso dos apps envolvidos. Toda a narrativa de economia da landing sai desses números.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "codigos",
    titulo: "Central de Captura de OTP",
    icone: "codigos",
    accent: "cyan",
    onde: "Menu › Central de Códigos",
    resumo:
      "Recebe o código de verificação que o streaming manda para o e-mail da conta matriz e entrega ao cliente certo, sem você repassar senha nenhuma.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "Quando um serviço pede confirmação (\"digite o código enviado ao e-mail da conta\"), o e-mail chega na caixa da matriz. A Central extrai o código de 4 a 6 dígitos, identifica o serviço pelo remetente/assunto e tenta descobrir o cliente pelo destinatário. O cliente vê o código no bloco \"Seu código de acesso recente\" do painel dele.",
      },
      {
        tipo: "campos",
        titulo: "As duas portas de entrada",
        itens: [
          {
            termo: "Automática (webhook)",
            desc: "Encaminhe a caixa da matriz para POST /api/webhooks/email. O código entra sozinho, sem intervenção. Opcionalmente proteja com EMAIL_WEBHOOK_TOKEN no .env.",
          },
          {
            termo: "Manual (colar e-mail)",
            desc: "Cole o conteúdo do e-mail no campo da aba. Inclua as linhas \"Para:\" e \"Assunto:\" — é assim que o sistema acerta o serviço e o cliente.",
          },
        ],
      },
      {
        tipo: "passos",
        titulo: "Fluxo de atendimento",
        itens: [
          "Cliente avisa que o app pediu código (ou abre chamado de erro de login).",
          "Registre o e-mail na Central (ou confirme que o webhook já capturou).",
          "Se o cliente não foi identificado automaticamente, vincule manualmente pelo seletor na linha do código.",
          "Peça ao cliente para abrir o painel: o código aparece com o tempo restante.",
        ],
      },
      {
        tipo: "aviso",
        tom: "atencao",
        texto:
          "Códigos expiram em 1 hora e são apagados automaticamente. Isso é proposital: OTP é efêmero e não deve virar histórico. Se expirou, gere um novo pedindo o reenvio no app.",
      },
      {
        tipo: "aviso",
        tom: "regra",
        texto:
          "Contas matrizes compartilhadas por vários clientes chegam com cliente em branco por segurança — o vínculo é manual. Nunca vincule por chute: entregar OTP ao cliente errado dá acesso à conta inteira.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "gamificacao",
    titulo: "Gamificação e Indicações",
    icone: "gamificacao",
    accent: "purple",
    onde: "Menu › Afiliados/Gamificação",
    resumo:
      "XP, níveis, missões e o programa de indicação. Tudo é calculado do histórico real — seu trabalho é entregar os prêmios que o sistema destrava.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "Cada cliente tem um código de indicação próprio e um link de cadastro (/signup?ref=CÓDIGO). Quem se cadastra por esse link fica vinculado como indicado. O XP vem de renovações em dia e de indicações que viram assinantes; a cada 250 XP o cliente sobe de nível.",
      },
      {
        tipo: "tabela",
        titulo: "Como o XP é ganho",
        colunas: ["Evento", "XP"],
        linhas: [
          ["Renovação em dia (fatura paga)", "+50 XP"],
          ["Indicação que virou assinante", "+150 XP"],
          ["Bônus da missão \"5 renovações em dia\"", "+100 XP"],
          ["Cada nível", "250 XP acumulados"],
        ],
      },
      {
        tipo: "tabela",
        titulo: "Níveis",
        colunas: ["Nível", "Título"],
        linhas: [
          ["1", "Iniciante"],
          ["2", "Bronze"],
          ["3", "Prata"],
          ["4", "Ouro"],
          ["5", "Platina"],
          ["6", "Diamante"],
          ["7", "Lenda PPN"],
        ],
      },
      {
        tipo: "tabela",
        titulo: "Trilha de missões",
        colunas: ["Missão", "Meta", "Recompensa"],
        linhas: [
          ["1ª renovação em dia", "1 renovação", "+50 XP"],
          ["3 renovações em dia", "3 renovações", "Cupom 15% OFF"],
          ["5 renovações em dia", "5 renovações", "+100 XP de bônus"],
          ["1 indicação que assina", "1 indicado assinante", "+150 XP"],
          ["3 indicações", "3 indicados assinantes", "1 mês de HBO Max grátis"],
          ["10 renovações", "10 renovações", "Prêmio especial"],
          ["12 meses ativo", "12 meses de casa", "Presente surpresa"],
        ],
      },
      {
        tipo: "passos",
        titulo: "Sua rotina na aba",
        itens: [
          "Abra a aba quando houver badge: ele conta os avisos pendentes, ou seja, prêmios que já foram destravados e esperam ação humana.",
          "Confira a árvore de indicações (quem indicou quem) e o XP de cada afiliado.",
          "Para prêmios físicos ou manuais (HBO Max grátis, prêmio especial, presente surpresa), execute a entrega e marque como entregue — isso registra o evento e limpa o aviso.",
          "O cupom de 15% OFF é automático: entra como desconto na próxima fatura do cliente, sem ação sua.",
        ],
      },
      {
        tipo: "aviso",
        tom: "regra",
        texto:
          "Não lance XP nem prêmio à mão. Todo evento tem chave única e é derivado de faturas pagas e cadastros com indicação — reprocessar é seguro, inventar quebra a auditoria.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "suporte",
    titulo: "Central de Suporte",
    icone: "suporte",
    accent: "red",
    onde: "Menu › Suporte",
    resumo:
      "Fila dos problemas relatados pelos clientes direto do card do acesso, com tipo, serviço e conta matriz já identificados.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "O cliente clica em \"Relatar problema\" no card do app e o chamado cai aqui já com o serviço e a conta matriz envolvidos — você não precisa perguntar \"qual app?\". O badge do menu soma os chamados abertos e em andamento.",
      },
      {
        tipo: "tabela",
        titulo: "Tipos de chamado e o que fazer",
        colunas: ["Tipo", "Causa típica", "Ação"],
        linhas: [
          [
            "Senha incorreta",
            "O serviço trocou a senha da matriz",
            "Atualize a senha no card da conta matriz — todos os vinculados passam a ver a nova",
          ],
          [
            "Conta sem crédito",
            "Assinatura da matriz venceu",
            "Renove a matriz e ajuste a data de vencimento no card",
          ],
          [
            "Erro de login",
            "O app pediu código de verificação",
            "Capture o OTP na Central de Códigos e vincule ao cliente",
          ],
          [
            "Tela ocupada",
            "Limite de telas simultâneas atingido",
            "Verifique a lotação da matriz; se estiver correta, oriente o cliente sobre uso simultâneo",
          ],
          ["Outro", "Caso livre descrito pelo cliente", "Trate pela descrição e responda no chamado"],
        ],
      },
      {
        tipo: "passos",
        titulo: "Atender um chamado",
        itens: [
          "Abra o chamado na fila e leia o tipo, a descrição e a conta matriz vinculada.",
          "Mude o status para \"em andamento\" para sinalizar que está sendo tratado.",
          "Resolva a causa raiz na tela correspondente (Estoque, Central de Códigos, Faturas).",
          "Escreva a resposta ao cliente e marque como resolvido — a resposta aparece na área de suporte do painel dele.",
          "Se precisar de conversa, use o atalho de WhatsApp com o telefone do cadastro.",
        ],
      },
      {
        tipo: "aviso",
        tom: "dica",
        texto:
          "O assistente de IA do painel do cliente já resolve dúvidas de \"como acessar\", códigos, faturas e jornada. Chamado que chega até você normalmente é problema real de conta — trate como prioridade.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "faturas",
    titulo: "Faturas e Receita",
    icone: "faturas",
    accent: "cyan",
    onde: "Menu › Faturas · gráfico na Visão Geral",
    resumo:
      "Série de cobranças gerada automaticamente do início da assinatura até hoje, com cupons, baixa de pagamento e receita real no gráfico.",
    blocos: [
      {
        tipo: "texto",
        texto:
          "Você não emite fatura manualmente. O sistema completa a série de cada cliente a partir da data de início e do ciclo (mensal ou anual), usando a chave cliente + competência — nunca duplica. O número segue o formato PPN-AAAA-MM-0000.",
      },
      {
        tipo: "campos",
        titulo: "Status da fatura",
        itens: [
          { termo: "pago", desc: "Competência quitada. Conta como renovação em dia na jornada de XP." },
          { termo: "aberto", desc: "Competência corrente, ainda dentro do prazo." },
          {
            termo: "vencido",
            desc: "Passou do vencimento com o cliente marcado como inadimplente. Entra no contador de pendências.",
          },
        ],
      },
      {
        tipo: "passos",
        titulo: "Dar baixa em um pagamento",
        itens: [
          "Menu › Faturas: localize o cliente e a competência.",
          "Registre o pagamento na linha correspondente.",
          "O valor entra no gráfico de receita e a renovação passa a contar na jornada do cliente (XP e missões).",
          "Se o cliente tem cupom de 15% ativo, o desconto já vem aplicado no valor final — confira antes de cobrar.",
        ],
      },
      {
        tipo: "aviso",
        tom: "atencao",
        texto:
          "Mudar a data de início da assinatura reescreve o calendário de vencimentos daquele cliente. Só faça isso para corrigir um cadastro errado, nunca para \"empurrar\" um vencimento.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "regras",
    titulo: "Regras de ouro e segurança",
    icone: "regras",
    accent: "red",
    onde: "Vale para todas as telas",
    resumo:
      "O que nunca deve acontecer no painel, e o combinado que mantém as contas matrizes vivas.",
    blocos: [
      {
        tipo: "campos",
        titulo: "Nunca",
        itens: [
          {
            termo: "Nunca exponha o estoque",
            desc: "Total de vagas, quem divide a matriz e e-mail de outras contas são informação interna.",
          },
          {
            termo: "Nunca entregue OTP sem certeza do cliente",
            desc: "Sem identificação confirmada, o código dá acesso à conta inteira. Confirme antes de vincular.",
          },
          {
            termo: "Nunca lance XP, prêmio ou fatura à mão",
            desc: "Todo dado operacional é derivado do histórico. Ajuste a origem, não o resultado.",
          },
          {
            termo: "Nunca exclua para \"limpar\"",
            desc: "Liberar vaga e ajustar status resolve quase tudo preservando auditoria. Exclusão é irreversível.",
          },
        ],
      },
      {
        tipo: "campos",
        titulo: "O que o cliente é orientado a fazer",
        itens: [
          {
            termo: "Não trocar a senha do serviço",
            desc: "Derruba todos os usuários da matriz. Se acontecer, o chamado chega como \"senha incorreta\" — reponha a senha no card.",
          },
          {
            termo: "Não usar \"sair de todos os dispositivos\"",
            desc: "Mesmo efeito: expulsa a matriz inteira.",
          },
          {
            termo: "Não criar/apagar perfis alheios",
            desc: "Cada cliente usa o perfil indicado no card do painel dele.",
          },
        ],
      },
      {
        tipo: "aviso",
        tom: "regra",
        texto:
          "Este manual é visível somente para contas com a flag de administrador. Clientes autenticados que tentarem acessar /admin são bloqueados na porta.",
      },
    ],
  },
];

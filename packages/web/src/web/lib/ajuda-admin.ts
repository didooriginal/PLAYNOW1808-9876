/**
 * DICIONÁRIO DE AJUDA DO PAINEL ADMIN
 * ------------------------------------------------------------------
 * Todo texto de tooltip do painel mora aqui. Motivo: o mesmo campo aparece em
 * telas diferentes (custo mensal está em Gestão de Contas, Estoque e Futebol Ao
 * Vivo) e a explicação precisa ser idêntica nos três lugares. Centralizando,
 * quem escreve a regra de negócio ajusta o texto num arquivo só — e ninguém
 * precisa caçar string solta dentro de JSX.
 *
 * Convenção de chave: `modulo.campo` (ex.: `contas.custoMensal`).
 * Convenção de texto: explique O QUE É + O QUE ACONTECE quando muda. Sem
 * repetir o próprio label ("Nome: o nome"), sem jargão de código.
 */

export const AJUDA: Record<string, string> = {
  /* ---------------- seções / abas do painel ---------------- */
  "secao.visao":
    "Resumo da operação lido direto do banco: faturamento, clientes ativos, fila de pendências e receita dos últimos meses. Nada aqui é editável.",
  "secao.estoque":
    "Suas contas matrizes (as assinaturas reais que você paga). Mostra quantas vagas estão ocupadas, quem está em cada vaga e quando cada conta renova.",
  "secao.pacotes":
    "Os combos que o cliente compra. Preço, tagline e serviços incluídos daqui alimentam a landing page e o checkout na hora.",
  "secao.aplicativos":
    "Catálogo de apps da plataforma. Um app precisa existir aqui antes de entrar em pacote, combo ou conta matriz.",
  "secao.clientes":
    "Base completa de assinantes: pacote, valor, próxima cobrança e situação de pagamento.",
  "secao.gestaocontas":
    "O caixa das contas matrizes: saldo de gift card, custo mensal, alerta de saldo crítico e os parâmetros do negócio.",
  "secao.marketing":
    "Biblioteca de textos prontos (promoções, boas-vindas, suporte) para copiar e colar no WhatsApp e nas redes. Nada aqui é enviado automaticamente.",
  "marketing.biblioteca":
    "Todos os textos salvos, do mais novo para o mais antigo. Copiar leva o conteúdo para a área de transferência; editar sobrescreve o texto salvo.",
  "marketing.titulo":
    "Nome interno do texto, só para você achar depois. O cliente nunca vê este campo.",
  "marketing.categoria":
    "Etiqueta para organizar a lista: promoção, suporte, boas-vindas ou geral. Não muda o conteúdo.",
  "marketing.conteudo":
    "A mensagem em si, exatamente como será colada no WhatsApp. Quebras de linha e emojis são preservados.",
  "marketing.copiloto":
    "Abre o Copiloto Admin (a IA do painel) já com o seu pedido escrito. A resposta vem no chat — copie e salve aqui como texto.",
  "cliente.nivel":
    "Nível do cliente na Jornada (1 a 7: Iniciante, Bronze, Prata, Ouro, Platina, Diamante, Lenda PPN). Ele sobe sozinho por XP; o que você define aqui é só um piso — o sistema nunca rebaixa. A carteira de afiliado, com saque em Pix, abre no nível 3.",
  "cliente.definirPacote":
    "Liga o cliente a um pacote fechado: grava pacote e ciclo, recalcula a mensalidade no servidor, cria o direito de cada app (na versão padrão do pacote) e já tenta alocar as vagas. Quem não couber entra na fila.",
  "cliente.cicloPacote":
    "De quanto em quanto tempo o cliente paga. O desconto por ciclo é aplicado pelo servidor: 5% no trimestral, 10% no semestral, 20% no anual.",
  "cliente.valorManualPacote":
    "Deixe em branco para usar o preço da tabela. Preencha só quando houver negociação: o valor digitado vira a mensalidade equivalente deste cliente.",
  "cliente.enderecoPerfil":
    "Endereço informado pelo próprio cliente na aba “Meus Dados”. Serve para envio de brindes e conferência no suporte — o ADM não precisa preencher.",
  "cliente.aparelhos":
    "Aparelhos que o cliente informou no cadastro. Serve de referência no suporte — o plano libera 2 aparelhos, 1 tela por vez.",
  "cliente.adminSelo":
    "Indica que esta conta também tem acesso ao painel administrativo. Contas com selo não entram nas contagens de faturamento de cliente.",
  "cliente.apps":
    "Todos os apps deste cliente: de onde veio cada um (pacote, avulso, combo ou prêmio), em qual conta matriz está alocado e quando vence. Quem aparece como \u0022aguardando vaga\u0022 pagou e ainda não tem conta — resolva primeiro.",
  "cliente.adicionarApp":
    "Adiciona um app a este cliente: cria o direito de uso (com vencimento próprio) e já coloca numa vaga livre. Sem vaga, o cliente entra na fila e você recebe um alerta.",
  "cliente.removerApp":
    "Tira o app deste cliente e devolve a vaga ao estoque. O histórico da alocação é preservado. A mensalidade cai já e o abatimento aparece na próxima fatura — o que ele pagou neste mês não é estornado.",
  "cliente.valorApp":
    "Quanto este app soma na mensalidade do cliente, por mês. Vem do preço do catálogo, mas você pode ajustar aqui (cortesia, combinado antigo, desconto de fidelidade).",
  "cliente.liberacaoApp":
    "\u0022Liberar agora\u0022 solta o acesso na hora e a cobrança vai na fatura — use com cliente de confiança. \u0022Após o pagamento\u0022 deixa o app preso: ele aparece como aguardando pagamento, não ocupa vaga e é liberado sozinho quando o pagamento cair.",
  "cliente.primeiroMesApp":
    "App que entra no meio do ciclo cobra 1 mês cheio à parte, somado à fatura em aberto. Do mês seguinte em diante ele já vai dentro da mensalidade. Desmarque para dar o primeiro mês de cortesia.",
  "cliente.valorManual":
    "A mensalidade normalmente é calculada sozinha (pacote + apps avulsos). Quando você digita o valor à mão, ela trava e nenhum app adicionado ou removido mexe mais nesse número. \u0022Voltar ao automático\u0022 destrava e recalcula.",
  "conta.ativa":
    "Liga ou desliga esta conta matriz. Ao desligar, os clientes que estavam nela são remanejados automaticamente para outras contas — nada é apagado. Quem não encontrar vaga entra na fila e gera alerta.",
  "cliente.alocarApp":
    "Coloca este cliente em uma vaga livre de conta matriz do serviço escolhido. Se não houver vaga, o sistema avisa em vez de alocar.",
  "cliente.admin":
    "Liga ou desliga o acesso ao painel administrativo desta conta. Mudança imediata: no próximo carregamento a pessoa entra (ou perde) o /admin.",
  "cliente.adminNovo":
    "Marque para já criar esta conta com acesso ao painel administrativo. Use apenas para a sua equipe.",
  "secao.estoquegift":
    "Os códigos de gift card que você já comprou e ainda não resgatou. Controla saldo disponível por provedor e aplica o código direto na conta matriz.",
  "secao.saude":
    "Contas com falha de login, entrada pausada automaticamente e alerta de estoque no limite. É o painel de risco da operação.",
  "secao.jogos":
    "Pool de contas do adicional de futebol. A liberação para o cliente é automática — seu trabalho é manter contas com vaga no pool.",
  "secao.winback":
    "Régua automática de recuperação: cliente inativo entra na fila com cupom pronto, seguindo os dias e o desconto configurados nos parâmetros.",
  "secao.afiliados":
    "Quem indicou quem, XP, níveis e prêmios. Comissão e bônus vêm dos parâmetros do negócio em Gestão de Contas.",
  "secao.suporte": "Problemas abertos pelos clientes. Responda e marque como resolvido daqui.",
  "secao.faturas": "Cobranças a vencer, recebidas e atrasadas, com o histórico de cada cliente.",
  "secao.codigos":
    "Códigos de verificação dos streamings extraídos do e-mail. Ficam válidos por 1 hora e são entregues ao cliente que pediu.",
  "secao.iptv":
    "Clientes que compraram o plano de canais ao vivo (IPTV) e enviaram o endereço MAC do aparelho pelo painel. Cadastre o MAC no servidor de IPTV e marque como ativado — o cliente é avisado na hora.",
  "iptv.fila":
    "Cada linha é um aparelho. Copie o MAC, cadastre no painel do servidor de IPTV e clique em “Marcar como ativado”. Recusar devolve ao cliente o pedido de conferir o número no app.",
  "iptv.pendentes":
    "Aparelhos que já receberam o MAC do cliente e ainda não foram cadastrados no servidor. Enquanto está aqui, o cliente não tem canal nenhum abrindo.",
  "iptv.ativados":
    "Total de aparelhos que você já liberou. Um mesmo cliente pode ter vários (TV Box, celular, Fire Stick).",
  "iptv.total":
    "Histórico completo de pedidos de ativação, incluindo recusados e cancelados pelo próprio cliente.",
  "secao.netflixtv":
    "Fila de pedidos de liberação de TV da Netflix. Você aprova e a TV do cliente destrava na hora.",
  "secao.alertas":
    "Fila única de tudo que exige ação humana: código pedido, TV para liberar, vencimento próximo e cliente atrasado.",
  "secao.senhas":
    "Pedidos de 'esqueci minha senha'. O e-mail sai automaticamente; aqui você acompanha e gera link manual quando o cliente não recebe.",
  "app.opcoes":
    "Versões do mesmo app com preços diferentes (ex.: Globoplay comum, Premium, Premium + Telecine). Na vitrine o app continua sendo UM card; o cliente escolhe a versão na contratação avulsa. Cada opção tem o próprio estoque: cadastre a conta matriz usando o slug da opção. Pacote é fechado e sempre entrega a opção marcada como padrão.",
  "app.opcaoNome":
    "Rótulo curto que o cliente vê, sem repetir o nome do app. Ex.: \u0022Premium + Telecine\u0022, e não \u0022Globoplay Premium + Telecine\u0022.",
  "app.opcaoDescricao":
    "Uma linha explicando o que muda nesta versão. Aparece abaixo do nome na hora da escolha.",
  "app.opcaoPreco":
    "Quanto a PLAYPLUSNOW cobra por mês nesta versão. Pode ser alterado a qualquer momento.",
  "app.opcaoPrecoAvulso":
    "Preço que o cliente pagaria direto no provedor. Serve só para o comparativo de economia.",
  "app.opcaoEntrega":
    "\u0022Login e senha\u0022 usa uma vaga de conta matriz do estoque (padrão). \u0022Convite do provedor\u0022 é para casos como a Netflix individual: o cliente informa o e-mail dele, o pedido cai na fila de Convites e você o cadastra como membro extra no painel do provedor — quem envia o acesso é a própria plataforma.",
  "secao.convites":
    "Clientes que contrataram uma opção entregue por convite (ex.: Netflix individual). Cadastre o e-mail informado como membro extra no painel do provedor e marque como enviado — o cliente acompanha esse status no painel dele.",
  "secao.minhasenha":
    "Troque a senha desta conta de administrador. Exige a senha atual; ao confirmar, as demais sessões são desconectadas.",
  "secao.manual": "Guia operacional do painel: o que cada módulo faz e o que fazer em cada situação.",

  /* ---------------- contas matrizes ---------------- */
  "estoque.filtroApp":
    "Mostra só as matrizes de um aplicativo. Pega todas as variações dele (ex.: Globoplay comum, Premium e Premium + Telecine).",
  "app.temGiftCard":
    "Marque quando esse app aceita gift card. Ele passa a aparecer na tela de Estoque de gift cards mesmo sem nenhum código cadastrado.",
  "gift.apps":
    "Quais apps aparecem aqui. Use 'Adicionar app' para trazer um app novo e 'Remover' para tirar da tela — só é possível remover quem não tem código disponível.",
  "contas.servico": "Qual app essa conta matriz serve. Define o ícone, o gift card aceito e em quais pacotes a vaga pode ser usada.",
  "contas.rotulo": "Apelido interno da conta, só você vê. Use um padrão como 'Netflix — Matriz 09' para achar rápido na busca.",
  "contas.email": "E-mail de login da assinatura real no site do streaming. É por ele que o sistema identifica os códigos de verificação que chegam.",
  "contas.emailCaptura":
    "Endereço do nosso domínio que recebe os códigos desta matriz (ex.: netflix01@mail.playplusnow.com.br). Configure o encaminhamento na conta do streaming para este endereço: quando o código chegar, ele entra sozinho na Central de Códigos e vai para o cliente que pediu. Vazio = captura automática desligada nesta conta.",
  "contas.senha": "Senha da conta no streaming. Fica guardada para você copiar quando precisar entrar — o cliente nunca vê.",
  "contas.totalVagas": "Quantos perfis/telas essa conta suporta vender. Passar desse número é overbooking: o sistema bloqueia a alocação.",
  "contas.vencimento": "Data em que a assinatura renova e o valor é debitado. Alimenta o alerta de vencimento e a conta de saldo necessário.",
  "contas.custoMensal": "Quanto essa conta custa por mês para você. Base do lucro por vaga e do cálculo automático de saldo crítico.",
  "contas.regiao": "País/região da conta, quando o preço ou o catálogo mudam por região. Deixe em branco se não se aplica.",
  "contas.observacao":
    "Anotação interna sobre a matriz (ex.: perfil reservado, conta em teste). Só o ADM vê.",
  "contas.cartao": "Qual cartão ou gift card paga essa conta. Ajuda a saber onde recarregar quando o saldo cai.",
  "contas.saldo": "Saldo de gift card disponível nessa conta hoje. Você nunca digita esse número: ele é o resultado dos lançamentos do extrato.",
  "contas.folga": "Quantos meses o saldo atual cobre, dividindo o saldo pelo custo mensal. Abaixo de 1 mês, recarregue.",
  "contas.limiteAlerta": "Valor que dispara o aviso de saldo crítico. Com 0, o sistema calcula sozinho: custo do mês + a margem definida nos parâmetros.",
  "contas.lancamentoTipo": "Crédito soma ao saldo (recarga), Consumo subtrai (renovação debitada) e Ajuste corrige divergência com o extrato real do streaming.",
  "contas.lancamentoValor": "Digite o valor movimentado, não o saldo final. O sistema soma ou subtrai e grava o resultado no extrato.",
  "contas.lancamentoObs": "Por que esse lançamento existe. Aparece no extrato junto do seu e-mail — é o que salva a auditoria daqui a 3 meses.",
  "contas.varrer": "Recalcula o saldo crítico de todas as contas agora e joga os avisos na Central de Alertas e no webhook, sem esperar a rotina automática.",
  "contas.aplicarGift": "Abre os códigos de gift card em estoque desse provedor para você resgatar nessa conta, sem digitar nada.",

  /* ---------------- estoque de gift cards ---------------- */
  "gift.provider": "Provedor em que o código será resgatado. O código só aparece nas contas matrizes desse mesmo app.",
  "gift.valorPadrao": "Valor de face aplicado às linhas que não trouxerem valor próprio. É o valor creditado no saldo quando você confirmar a aplicação.",
  "gift.codigos": "Um código por linha. Para valores diferentes no mesmo lote use CODIGO;70 ou CODIGO;70;observação. Repetidos são ignorados, então pode reenviar o lote sem medo.",
  "gift.observacaoLote": "Origem do lote (fornecedor, número da nota). Fica gravado em cada código para conferência com o financeiro.",
  "gift.status": "Disponível = livre no estoque. Em uso = alguém copiou e está resgatando. Utilizado = já resgatado, saldo creditado.",
  "gift.mascara": "O código nunca aparece inteiro na lista: use o olho para revelar apenas um por vez ou copie direto, sem revelar.",
  "gift.copiar": "Copia o código para a área de transferência e marca como 'em uso', evitando que outro admin aplique o mesmo código.",
  "gift.confirmar": "Confirma que o código foi resgatado no site do streaming: ele vira 'utilizado' e o valor entra no saldo da conta com lançamento no extrato.",
  "gift.devolver": "Devolve ao estoque um código que ficou 'em uso' mas não foi resgatado.",
  "gift.remover": "Apaga o código do estoque. Use apenas para cadastro errado — histórico de aplicados se perde.",
  "gift.disponivelValor": "Dinheiro parado em códigos ainda não resgatados. É saldo que você já pagou e pode usar a qualquer momento.",
  "gift.mesesFolga": "Quantos meses o estoque livre desse provedor cobre, considerando o custo mensal somado das contas dele.",

  /* ---------------- catálogo de aplicativos ---------------- */
  "app.nome": "Nome comercial do app como o cliente vê na landing, no checkout e no painel dele.",
  "app.mono": "Duas a quatro letras usadas no ícone quando não há logo enviada. Ex.: MX para Max.",
  "app.cor": "Cor da marca, usada no ícone e nos gráficos. Cole o hex ou escolha no seletor.",
  "app.tipo": "Tipo de mídia do serviço (vídeo, música, leitura). Organiza o catálogo e a vitrine do cliente.",
  "app.categoria": "Categoria comercial do app. Define em qual bloco ele aparece na landing e nos filtros do painel.",
  "app.precoAvulso": "Quanto o serviço custa sozinho no site oficial. É a referência de 'economia' mostrada ao cliente — não é o seu custo.",
  "app.precoVenda":
    "Quanto a PLAYPLUSNOW cobra por este app avulso, por mês. É o número que aparece na vitrine e entra na conta do cliente. Digite e clique em Salvar — nada é gravado antes disso.",
  "app.precoMercado":
    "Preço de tabela do serviço oficial, usado só no comparativo 'Do jeito tradicional'. Quanto maior, maior a economia exibida. Se ficar igual ao seu preço, o cliente vê economia zero.",
  "app.ativo": "Desligado, o app sai da vitrine e não pode entrar em novos pacotes. Clientes que já têm continuam usando.",

  /* ---------------- combos e pacotes ---------------- */
  "combo.apps": "Marque os apps que entram no combo. A soma dos preços avulsos vira o valor riscado exibido ao cliente.",
  "combo.nome": "Nome do combo na vitrine. Nomes curtos convertem melhor que descritivos longos.",
  "combo.descricao": "Chamada curta abaixo do nome, no card. Opcional.",
  "combo.preco": "Preço promocional cobrado do cliente. O desconto contra a soma avulsa é calculado automaticamente.",
  "combo.ciclo": "Mensal cobra todo mês; Anual cobra 12 meses de uma vez, com o preço apresentado por mês.",
  "combo.visivelLanding": "Publica o combo na página de vendas. Desligado, ele existe mas só é vendido por link direto.",
  "combo.visivelCliente": "Oferece esse combo como upgrade dentro do painel de quem já é cliente.",
  "combo.destaque": "Marca o combo como 'mais vendido': ele ganha selo e posição de destaque no card.",
  "combo.ativo": "Desligado, o combo para de ser vendido. Quem já assinou continua com os apps liberados.",
  "combo.remover": "Apaga o combo da vitrine de forma definitiva. Assinaturas já feitas não são canceladas.",
  "pacote.nome": "Nome do pacote como aparece na landing e na fatura do cliente.",
  "pacote.precoMensal": "Valor cobrado por mês no plano mensal.",
  "pacote.precoAnual": "Valor por mês quando o cliente paga o ano inteiro. Use para mostrar a economia do anual.",
  "pacote.tagline": "Frase de apoio no card do pacote na landing.",
  "pacote.beneficios": "Benefícios separados por vírgula. Cada um vira um item com check no card.",
  "pacote.vagas": "Vagas restantes anunciadas para criar escassez real. Chegando a zero, o pacote aparece como esgotado.",
  "pacote.destaque": "Coloca o selo de destaque e sobe o pacote na vitrine.",
  "pacote.accent": "Cor de destaque do card na landing: vermelho, ciano ou roxo.",
  "pacote.badge": "Etiqueta curta no topo do card, tipo 'Mais vendido' ou 'Novo'. Deixe vazio para não mostrar nada.",
  "pacote.apps": "Apps que o cliente recebe ao assinar esse pacote.",
  "pacote.ativar": "Liga e desliga a venda do pacote. Desligado, ele sai da landing, mas quem já assina continua com tudo liberado.",
  "pacote.editar": "Abre a edição completa do pacote: nome, preços, tagline, benefícios, apps, vagas, cor e etiqueta.",

  /* ---------------- clientes e faturas ---------------- */
  "cliente.nome": "Nome do cliente como aparece na fatura e nas mensagens automáticas.",
  "cliente.email": "E-mail de acesso do cliente e destino de cobrança, código e recuperação de senha. Precisa ser único.",
  "cliente.pacote": "Pacote que o cliente assina. Define os apps liberados e o valor sugerido da cobrança.",
  "cliente.valor": "Valor efetivamente cobrado desse cliente. Pode diferir do preço de tabela em caso de desconto negociado.",
  "cliente.excluir": "Remove o cliente e libera as vagas dele. O histórico de faturas é apagado junto — prefira marcar como cancelado.",
  "pacote.excluir": "Apaga o pacote da vitrine. Clientes que já assinam continuam com os apps liberados.",
  "cliente.confianca": "Crédito de confiança: libera o acesso do cliente atrasado por um prazo, como se ele estivesse em dia. Quando o prazo vence, o bloqueio volta sozinho.",
  "cliente.confiancaHoras": "Duração do crédito em horas. O padrão é 48h; aceita de 1h até 30 dias.",
  "cliente.confiancaMotivo": "Por que você liberou o acesso. Fica registrado no cliente e aparece no aviso enviado a ele.",
  "cliente.confiancaRevogar": "Encerra o crédito agora. O cliente volta a ficar bloqueado imediatamente.",
  "cliente.confiancaAtiva": "Tempo que ainda resta do crédito de confiança concedido a esse cliente.",
  "cliente.proximaCobranca": "Data da próxima fatura. Alimenta o alerta de vencimento e a régua de cobrança.",
  "fatura.novaData": "Nova data de vencimento. A alteração fica registrada no histórico do cliente com o motivo.",
  "fatura.motivo": "Justificativa da mudança de vencimento, mínimo 5 caracteres. É o que protege você numa contestação.",
  "busca.afiliados": "Busca pelo nome do cliente ou pelo código de indicação dele.",
  "busca.manual": "Busca em todos os tópicos do manual e mostra só as seções que citam o termo.",
  "suporte.resposta": "Observação interna ou resposta enviada ao cliente junto da mudança de status do chamado.",
  "busca.contas": "Busca por rótulo da conta, e-mail de login ou nome do cliente alocado.",

  /* ---------------- parâmetros do negócio ---------------- */
  "param.comissaoPercentual": "Percentual pago ao afiliado sobre cada fatura paga de um indicado dele. Vale para as faturas novas, não recalcula o passado.",
  "param.bonusCredito": "Acréscimo dado quando o afiliado troca o saque em dinheiro por desconto na própria mensalidade. Sai mais barato para o caixa.",
  "param.bonusPerformance": "Bônus extra quando a rede do afiliado bate a meta de indicados em dia.",
  "param.metaRedeEmDia": "Percentual mínimo de indicados adimplentes para o afiliado receber o bônus de performance.",
  "param.saqueMinimo": "Valor mínimo acumulado para o afiliado pedir saque em Pix.",
  "param.saqueTaxa": "Custo fixo descontado de cada saque em Pix, para cobrir a tarifa da operação.",
  "param.margemSaldoCritico": "Folga exigida acima do custo mensal antes de considerar o saldo crítico. Com 20%, uma conta de R$ 100/mês alerta abaixo de R$ 120.",
  "param.alertaOcupacao": "Percentual de ocupação das vagas que dispara o aviso de comprar nova conta matriz.",
  "param.falhasParaPausar": "Quantas falhas de login em 30 dias pausam a entrada de novos clientes naquela conta.",
  "param.winbackDias": "Dias de inatividade antes da primeira oferta de retorno ao ex-cliente.",
  "param.winbackDesconto": "Desconto base do cupom da régua de recuperação.",
  "param.precoSalaJogos": "Mensalidade cobrada pelo adicional de futebol ao vivo.",
  "param.horasLiberacaoJogos": "Por quantas horas o acesso liberado ao cliente continua valendo antes da vaga voltar ao pool.",

  /* ---------------- futebol ao vivo (pool) ---------------- */
  "jogos.rotulo": "Apelido interno da conta no pool, para você diferenciar as contas na fila de liberação.",
  "jogos.appPool":
    "Qual app essa conta do pool usa (só para você se organizar). A conta continua sendo vendida como 'jogos' e não entra no estoque normal.",
  "jogos.servico": "Slug do serviço no catálogo. Mantenha 'jogos' para o adicional de futebol.",
  "jogos.email": "Login da conta usada nas liberações do adicional.",
  "jogos.senha": "Senha entregue ao cliente durante a janela de liberação. Troque quando desconfiar de vazamento.",
  "jogos.vagas": "Quantos clientes podem usar essa conta ao mesmo tempo. O sistema respeita esse limite na liberação automática.",
  "jogos.custoMensal": "Custo mensal dessa conta do pool, usado no lucro do adicional.",

  /* ---------------- central de códigos ---------------- */
  "codigos.colar": "Cole o e-mail recebido do streaming: o sistema extrai o código, identifica a conta e entrega ao cliente que pediu.",
  "codigos.entradaAutomatica": "Endereço que recebe os e-mails dos streamings. Chegando ali, o código é lido e entregue sem você fazer nada.",
  "codigos.expira": "Todo código vale 1 hora. Depois disso ele sai da lista e o cliente precisa pedir de novo.",
  "codigos.copiar": "Copia o código para a área de transferência, sem risco de erro de digitação.",
  "codigos.descartar": "Descarta um código errado ou já usado, tirando-o da fila do cliente.",
  "codigos.caixa": "Todo e-mail que entra pelo webhook aparece aqui com o texto completo — inclusive os que não têm código nenhum, como a confirmação do Gmail. Fica guardado por 7 dias.",
  "codigos.abrirEmail": "Abre o conteúdo integral da mensagem, do jeito que o provedor enviou.",
  "codigos.fixarEmail": "Fixa a mensagem para ela não ser apagada pela limpeza automática de 7 dias.",
  "codigos.copiarEmail": "Copia o texto completo do e-mail para a área de transferência.",
  "codigos.excluirEmail": "Apaga esta mensagem da caixa de entrada. Não afeta o código já entregue ao cliente.",
  "codigos.buscaEmail": "Busca por remetente, destinatário, assunto ou qualquer palavra dentro do corpo do e-mail.",

  /* ---------------- senhas & netflix tv ---------------- */
  "senhas.emailCliente": "E-mail do cliente que perdeu o acesso. Gera um link manual de redefinição quando o e-mail automático não chega.",
  "jogos.poolTitulo": "Contas compartilhadas usadas só no adicional de futebol. O sistema empresta uma vaga na hora do jogo e devolve depois.",
  "jogos.liberacoesAtivas": "Acessos liberados agora: quem está usando, em qual conta e quando a vaga volta para o pool.",
  "jogos.assinantes": "Clientes que pagam o adicional de futebol e podem pedir liberação.",
  "codigos.filaTitulo": "Códigos de verificação recebidos, mais recentes primeiro. Cada um vale 1 hora.",
  "codigos.filtroStatus": "Filtra a fila por situação do código: entregue, aguardando ou expirado.",
  "comissoes.resgates": "Pedidos de saque dos afiliados. Aprovar debita o saldo dele e registra o pagamento; recusar devolve o saldo.",
  "comissoes.antifraude": "Indicações vindas do mesmo IP ou dispositivo do afiliado ficam retidas aqui até você liberar.",
  "saude.fila":
    "Clientes que pagaram mas ficaram sem vaga — normalmente depois de repor ou desligar uma matriz. Assim que uma vaga abre no serviço, o sistema aloca sozinho; o WhatsApp serve para avisar antes disso.",
  "saude.resolverFila":
    "Tenta alocar o cliente agora e tira ele da fila. Se não houver vaga livre, o item continua aqui e o motivo aparece embaixo.",
  "saude.cancelarFila":
    "Fecha o pedido sem alocar — use quando o cliente desistiu, pediu errado ou o item está duplicado.",
  "saude.estoquePorServico": "Ocupação das vagas por serviço. Serviço perto de 100% precisa de conta matriz nova antes da próxima venda.",
  "saude.contasFalhas": "Contas que acumularam falhas de login. Passando do limite dos parâmetros, elas param de receber cliente novo.",
  "saude.ultimasFalhas": "Últimas falhas relatadas por clientes ou pela varredura automática, com data e conta envolvida.",
  "pix.ambiente":
    "Origem das credenciais em uso. \"produção\" significa que os pagamentos são reais e caem na sua conta do Mercado Pago; \"TESTE\" é sandbox e não movimenta dinheiro.",
  "pix.baixaManual":
    "Marca a cobrança como paga na mão. Use só quando o cliente pagou fora do gateway (dinheiro, transferência) — o Pix do Mercado Pago já dá baixa sozinho pelo webhook.",
  "pix.cancelarCobranca":
    "Descarta esta cobrança. O cliente pode gerar outra a qualquer momento; nada é cobrado dele.",
  "pix.assinaturas":
    "Assinaturas no cartão de crédito (recorrência do Mercado Pago). O cliente autoriza o cartão uma vez e o gateway cobra a cada ciclo automaticamente.",
  "pix.recorrenciaAtiva":
    "Cartão autorizado e cobrando sozinho. Você não precisa fazer nada a cada mês.",
  "pix.dominio":
    "O Mercado Pago só aceita URL pública https em back_url e notification_url. Enquanto MERCADOPAGO_SITE_URL apontar para localhost, o webhook não chega e a assinatura no cartão falha na criação.",
  "pix.cobrancas": "Cobranças Pix geradas, com status de pagamento vindo do provedor.",
  "senhas.titulo": "Redefinições de senha pedidas pelos clientes e links gerados manualmente por você.",
  "conta.liberarVaga": "Libera a vaga mantendo o cadastro e o histórico do cliente — use quando ele sai mas pode voltar.",
  "conta.liberarTodas": "Libera todas as vagas dessa conta para realocação. O histórico e os cadastros continuam intactos.",
  "conta.copiarLogin": "Copia e-mail e senha da conta matriz para a área de transferência.",
  "conta.excluir": "Exclui a conta matriz. Só faça isso quando a assinatura real já foi cancelada no streaming.",
  "netflix.codigoTv": "Código de 4 dígitos que o cliente leu na TV (netflix.com/tv2). Aprovar libera o aparelho dele na hora.",

  /* ---------------- alertas ---------------- */
  /* ---------------- resumo de entrada (pop-up) ---------------- */
  "resumo.popup":
    "Pop-up que abre quando voce entra no painel com tudo que esta parado esperando acao: codigos, TV, MAC, chamados, senhas, convites, faturas e estoque. Cada linha leva direto para a secao responsavel.",
  "resumo.alertas":
    "Os alertas mais recentes da Central de Alertas que ainda nao foram lidos. Serve de contexto rapido; a fila completa fica na propria Central.",
  "resumo.botao":
    "Abre o resumo de pendencias na hora, mesmo com o pop-up automatico desligado. O numero ao lado e o total de itens esperando acao.",
  "resumo.interruptor":
    "Liga ou desliga a abertura automatica do resumo quando voce entra no painel. A escolha vale para este navegador/aparelho; o botao Novidades continua funcionando dos dois modos.",
  "alertas.fila":
    "Alertas gerados pelo sistema: vencimento próximo, saldo crítico, falha de login e ocupação alta.",
  "alertas.filtroNaoLidas": "Esconde os alertas já lidos e deixa só o que ainda precisa de ação.",
  "alertas.reavaliar":
    "Roda a checagem de vencimentos, saldos e ocupação agora, sem esperar a rotina automática.",
  "alertas.marcarTodas":
    "Marca toda a fila como lida. O histórico continua guardado, só sai do contador.",
  "alertas.marcarLida": "Marca este alerta como lido e tira do contador de pendências.",
  "alertas.resolver":
    "Encerra o alerta: o problema acabou. Ele sai da fila na hora. Alertas de cobrança e de fila de vaga também se encerram sozinhos quando o cliente paga ou consegue a vaga.",
  "alertas.verResolvidos":
    "Mostra também os alertas já encerrados, para conferir o histórico ou reabrir algum fechado por engano.",
  "alertas.reabrir": "Devolve o alerta encerrado para a fila de pendências.",

  /* ---------------- recuperação (winback) ---------------- */
  "winback.pendentes": "Clientes inativos com oferta pronta que ainda não foi enviada.",
  "winback.enviados": "Ofertas já enviadas que continuam sem resposta do cliente.",
  "winback.recuperados": "Clientes que voltaram a assinar depois de receber a oferta.",
  "winback.varrer":
    "Recalcula quem entra na régua conforme os dias de inatividade e o desconto dos parâmetros.",
  "winback.copiar": "Copia a mensagem pronta, já com nome, cupom e desconto do cliente.",
  "winback.whatsapp": "Abre a conversa no WhatsApp com a mensagem preenchida.",
  "winback.marcarEnviado":
    "Registra o envio e trava o cupom na conta do cliente, então o desconto vale só para ele.",
  "winback.voltou": "Marca como recuperado: o cliente voltou a pagar e sai da régua.",
  "winback.descartar":
    "Tira o cliente da régua sem recuperação. Ele não recebe mais mensagens desta campanha.",

  /* ---------------- ordem da grade de apps ---------------- */
  "ordem.grade":
    "Define em que sequência os aplicativos aparecem na vitrine da landing e no montador de combo. Os primeiros da lista são os mais vistos — deixe ali o que você mais quer vender.",
  "ordem.confirmar":
    "Grava a nova sequência. Enquanto você não confirmar, a landing continua mostrando a ordem antiga, então pode reorganizar com calma.",

  /* ---------------- salvamento / backup ---------------- */
  "salvamento.confirmar":
    "As alterações já são salvas sozinhas alguns segundos depois de você digitar. Este botão salva na hora e mostra o selo 'Salvo' para você ter certeza antes de sair da tela.",
  "backup.baixar":
    "Baixa uma planilha .xlsx com uma aba por tabela do banco (clientes, contas, pacotes, faturas...). Serve de cópia de segurança e para conferir números fora do painel.",
  "backup.senhas":
    "Inclui na planilha a senha das contas matrizes. Só marque se o arquivo for ficar em lugar seguro — qualquer pessoa com a planilha consegue entrar nos streamings.",
};

/**
 * Resolve o texto de ajuda. Aceita chave do dicionário ("contas.custoMensal")
 * ou o texto pronto — assim uma tela com ajuda muito específica não é obrigada
 * a poluir o dicionário global.
 */
export function textoDeAjuda(chave: string): string | null {
  const achado = AJUDA[chave];
  if (achado) return achado;

  /** parece chave (sem espaço e com ponto) e não existe: erro de digitação */
  if (/^[a-z][\w-]*(\.[\w-]+)+$/i.test(chave)) {
    if (import.meta.env.DEV) console.warn(`[ajuda] chave sem texto no dicionário: "${chave}"`);
    return null;
  }

  return chave;
}

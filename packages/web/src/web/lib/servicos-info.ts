// COMO ACESSAR CADA SERVIÇO.
// Fonte única das instruções que o cliente vê no modal "Como acessar" e do link
// direto para o site/app oficial em cada card do painel.
//
// `tipo` muda o roteiro de login:
//   - "web"  → site no navegador (Netflix, Disney+, ...)
//   - "app"  → app/TV Box com código de ativação (IPTV, UniTV, Funplay, ...)
//   - "perfil" → conta compartilhada onde o cliente tem um PERFIL próprio

export type TipoAcesso = "web" | "app" | "perfil";

export type ServicoInfo = {
  /** site oficial — abre em nova aba */
  url: string;
  /** rótulo do botão de acesso direto */
  rotulo: string;
  /** onde dá para assistir, em uma linha */
  dispositivos: string;
  tipo: TipoAcesso;
  /** passo a passo do primeiro login */
  passos: string[];
  /** dicas de uso específicas do serviço */
  dicas: string[];
};

/** regras que valem para TODOS os serviços — sempre exibidas no modal */
export const REGRAS_OURO: string[] = [
  "Nunca troque a senha, o e-mail ou o telefone da conta — isso derruba o acesso e o pedido de reposição pode levar até 24h.",
  "Não convide outras pessoas, não altere o plano e não cancele nada dentro do app.",
  "Use somente o seu perfil. Mexer no perfil de outro usuário apaga a lista e o histórico dele.",
  "Se pedir um código de verificação por e-mail, pegue em “Seu código de acesso recente” aqui no painel.",
  "Deu erro de login ou “muitos dispositivos”? Use o botão Relatar problema no card — a reposição é automática.",
];

const PASSOS_WEB = (nome: string) => [
  `Toque em “Abrir ${nome}” para ir ao site oficial (abre em uma nova aba).`,
  "Escolha Entrar / Fazer login.",
  "Copie o e-mail no card do painel e cole no campo de e-mail.",
  "Copie a senha no card do painel e cole no campo de senha.",
  "Se aparecer pedido de código de verificação, volte ao painel e pegue em “Seu código de acesso recente”.",
];

const PASSOS_PERFIL = (nome: string) => [
  `Toque em “Abrir ${nome}” e faça login com o e-mail e a senha do card.`,
  "Na tela de perfis, escolha o perfil com o SEU nome.",
  "Se ainda não existe um perfil seu, crie um com o seu primeiro nome.",
  "Pronto: sua lista e seu histórico ficam salvos nesse perfil.",
];

const PASSOS_APP = (nome: string) => [
  `Instale o app do ${nome} na TV Box, Fire Stick, celular ou Smart TV.`,
  "Abra o app e vá em Ativar / Login com código.",
  "Digite o e-mail e a senha (ou o código de ativação) que estão no card do painel.",
  "Aguarde a lista de canais carregar — na primeira vez pode levar um minuto.",
];

const DICAS_PADRAO = [
  "Assista em 1 tela por vez. Duas telas simultâneas no mesmo acesso podem travar a conta.",
  "Prefira o app oficial na Smart TV: a qualidade fica melhor do que no navegador.",
];

function web(
  url: string,
  nome: string,
  dispositivos: string,
  dicas: string[] = [],
  tipo: TipoAcesso = "web",
): ServicoInfo {
  return {
    url,
    rotulo: `Abrir ${nome}`,
    dispositivos,
    tipo,
    passos: tipo === "perfil" ? PASSOS_PERFIL(nome) : PASSOS_WEB(nome),
    dicas: [...dicas, ...DICAS_PADRAO],
  };
}

function app(url: string, nome: string, dispositivos: string, dicas: string[] = []): ServicoInfo {
  return {
    url,
    rotulo: `Site do ${nome}`,
    dispositivos,
    tipo: "app",
    passos: PASSOS_APP(nome),
    dicas: [...dicas, "Precisa de internet estável — em 4K o ideal é cabo ou Wi-Fi 5GHz."],
  };
}

export const SERVICOS_INFO: Record<string, ServicoInfo> = {
  /* ---------------- streaming de vídeo ---------------- */
  netflix: web("https://www.netflix.com/br/login", "Netflix", "Smart TV, celular, navegador, console", [
    "Escolha sempre o perfil com o seu nome — a Netflix guarda “Continuar assistindo” por perfil.",
    "Se pedir “Atualize sua residência”, não confirme nada: peça o código pelo painel.",
  ], "perfil"),
  "netflix-individual": web("https://www.netflix.com/br/login", "Netflix", "Smart TV, celular, navegador, console", [
    "Sua conta é individual: você pode criar e renomear os perfis como quiser.",
  ]),
  disney: web("https://www.disneyplus.com/pt-br/login", "Disney+", "Smart TV, celular, navegador, console", [
    "O acervo do Star+ está dentro do Disney+, na aba Star.",
  ], "perfil"),
  star: web("https://www.starplus.com", "Star+", "Smart TV, celular, navegador", [
    "O conteúdo do Star+ migrou para o Disney+ — se pedir, faça login pelo Disney+.",
  ], "perfil"),
  prime: web("https://www.primevideo.com", "Prime Video", "Smart TV, celular, navegador, Fire Stick", [
    "Entre em Prime Video e não na loja da Amazon — o acesso é só do streaming.",
    "Não use o carrinho nem os dados de pagamento da conta.",
  ], "perfil"),
  hbomax: web("https://play.max.com/br", "HBO Max", "Smart TV, celular, navegador", [
    "O HBO Max agora é Max: se o app pedir atualização, atualize normalmente.",
  ], "perfil"),
  paramount: web("https://www.paramountplus.com/br/", "Paramount+", "Smart TV, celular, navegador", []),
  appletv: web("https://tv.apple.com/br", "Apple TV+", "Apple TV, Smart TV, celular, navegador", [
    "No iPhone/iPad, saia da sua Apple ID pessoal dentro do app TV antes de entrar.",
    "Na dúvida, use o navegador em tv.apple.com — é o caminho mais simples.",
  ]),
  globoplay: web("https://globoplay.globo.com", "Globoplay", "Smart TV, celular, navegador", [
    "Login pela Conta Globo. Não vincule seu CPF nem altere os dados do titular.",
  ], "perfil"),
  "globoplay-premium": web("https://globoplay.globo.com", "Globoplay Premium", "Smart TV, celular, navegador", [
    "No Premium você também tem os canais ao vivo dentro do Globoplay.",
  ], "perfil"),
  telecine: web("https://globoplay.globo.com/telecine/", "Telecine", "Smart TV, celular, navegador", [
    "O Telecine é assistido dentro do Globoplay, na área Telecine.",
  ], "perfil"),
  looke: web("https://www.looke.com.br", "Looke", "Smart TV, celular, navegador", []),
  recordplus: web("https://www.recordplus.com", "RecordPlus", "Smart TV, celular, navegador", [
    "O antigo PlayPlus agora é RecordPlus — use o app novo.",
  ]),
  "brasil-paralelo": web("https://www.brasilparalelo.com.br", "Brasil Paralelo", "Smart TV, celular, navegador", [
    "Os documentários ficam na área Assistir, depois de fazer login.",
  ]),
  univer: web("https://www.univervideo.com", "Univer Vídeo", "Smart TV, celular, navegador", []),

  /* ---------------- esportes ---------------- */
  premiere: web("https://globoplay.globo.com/premiere/", "Premiere", "Smart TV, celular, navegador", [
    "Os jogos aparecem na aba Agora no ar assim que a transmissão começa.",
    "Em dia de rodada, entre com 10 minutos de antecedência.",
  ], "perfil"),
  "premiere-globoplay": web("https://globoplay.globo.com", "Premiere + Globoplay", "Smart TV, celular, navegador", [
    "Mesmo login para o Globoplay e para os canais Premiere.",
  ], "perfil"),
  "premiere-prime": web("https://globoplay.globo.com/premiere/", "Premiere", "Smart TV, celular, navegador", [
    "Este combo tem dois logins: o do Premiere e o do Prime Video. Cada um no seu card.",
  ], "perfil"),
  dazn: web("https://www.dazn.com/pt-BR", "DAZN", "Smart TV, celular, navegador", [
    "Use somente 1 dispositivo por vez — a DAZN bloqueia telas simultâneas.",
  ]),
  combate: web("https://combate.globo.com", "Combate", "Smart TV, celular, navegador", [
    "Nos eventos de UFC, entre antes do card principal para evitar fila de acesso.",
  ], "perfil"),

  /* ---------------- música ---------------- */
  spotify: web("https://open.spotify.com", "Spotify", "Celular, navegador, Smart TV, carro", [
    "Suas playlists ficam na SUA conta — não apague playlist que não é sua.",
    "Não mexa em “Sair de todos os dispositivos”: isso derruba os outros usuários.",
  ]),
  deezer: web("https://www.deezer.com/br/login", "Deezer", "Celular, navegador, Smart TV", []),

  /* ---------------- vídeo / criadores ---------------- */
  youtube: web("https://www.youtube.com", "YouTube Premium", "Celular, navegador, Smart TV", [
    "Confirme que o Premium está ativo: no app, seu avatar mostra o selo Premium.",
    "Para baixar vídeos offline, use o app oficial no celular.",
  ], "perfil"),
  "youtube-individual": web("https://www.youtube.com", "YouTube Premium", "Celular, navegador, Smart TV", [
    "Conta individual: dá para usar seu próprio histórico e inscrições.",
  ]),
  canva: web("https://www.canva.com/login", "Canva Pro", "Navegador, celular, tablet", [
    "Entre por e-mail e senha (não use “Entrar com Google”).",
    "Salve seus projetos em uma pasta com o seu nome.",
  ]),
  capcut: web("https://www.capcut.com/login", "CapCut Pro", "Celular, navegador, desktop", [
    "No celular, saia da conta antiga antes de entrar com o login do painel.",
  ]),

  /* ---------------- conteúdo asiático ---------------- */
  crunchyroll: web("https://www.crunchyroll.com/pt-br/login", "Crunchyroll", "Smart TV, celular, navegador", [
    "Simulcast dos animes da temporada sai poucas horas depois do Japão.",
  ], "perfil"),
  kocowa: web("https://www.kocowa.com/pt_br/signin", "KOCOWA+", "Smart TV, celular, navegador", [
    "Legendas em português: ativa no ícone de engrenagem do player.",
  ]),
  vikki: web("https://www.viki.com/", "Viki", "Smart TV, celular, navegador", [
    "Selecione Português (Brasil) nas legendas — o padrão vem em inglês.",
  ]),

  /* ---------------- IPTV / TV ao vivo ---------------- */
  iptv: app("https://unitv.net.br", "IPTV", "TV Box, Fire Stick, Smart TV, celular", [
    "Guarde o código de ativação: ele é só seu e não deve ser repassado.",
  ]),
  unitv: app("https://unitv.net.br", "UniTV", "TV Box, Fire Stick, Smart TV, celular", [
    "A recarga é mensal — renove pelo painel antes do vencimento para não perder o acesso.",
  ]),
  "unitv-vitalicio": app("https://unitv.net.br", "UniTV", "TV Box, Fire Stick, Smart TV, celular", [
    "Seu plano é vitalício: não existe recarga a pagar, só manter o app atualizado.",
  ]),
  funplay: app("https://funplays.cloud", "Fun Play", "TV Box, Fire Stick, Smart TV, celular", [
    "Se a lista não carregar, feche o app por completo e abra de novo.",
  ]),
  clarotv: app("https://www.clarotvmais.com.br", "Claro TV+", "Smart TV, celular, navegador, TV Box", [
    "No Claro TV+ os canais ao vivo ficam na aba TV ao vivo.",
  ]),
  skytv: app("https://www.sky.com.br", "Sky TV", "Smart TV, celular, navegador, TV Box", [
    "Use o app Sky+ para assistir aos canais fora de casa.",
  ]),
};

/** fallback seguro: qualquer slug novo cadastrado pelo admin continua funcionando */
export function servicoInfo(slug: string, nome: string): ServicoInfo {
  return (
    SERVICOS_INFO[slug] ?? {
      url: `https://www.google.com/search?q=${encodeURIComponent(`${nome} entrar login`)}`,
      rotulo: `Abrir ${nome}`,
      dispositivos: "Smart TV, celular, navegador",
      tipo: "web",
      passos: PASSOS_WEB(nome),
      dicas: DICAS_PADRAO,
    }
  );
}

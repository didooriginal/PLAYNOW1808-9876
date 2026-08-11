import ExcelJS from "exceljs";
import { db } from "../database";
import {
  alocacoes,
  aplicativos,
  assinaturas,
  carteiras,
  chamados,
  cobrancasPix,
  combos,
  comissoes,
  configuracoes,
  contasMatrizes,
  faturas,
  giftCards,
  movimentacoesGift,
  pacotes,
  saques,
  usuarios,
} from "../database/schema";

/**
 * BACKUP DO BANCO EM EXCEL — uma aba por tabela.
 *
 * Pensado para o dono da operação conseguir levar os dados embora sem depender
 * de ninguém: abre no Excel/Google Sheets e serve de prova em caso de disputa.
 *
 * Duas decisões de segurança importantes:
 *  - `contas_matrizes.senha` só entra quando o admin pede explicitamente
 *    (`incluirSenhas`), porque uma planilha vazada com as senhas das matrizes
 *    derruba a operação inteira;
 *  - hashes de sessão/autenticação NUNCA entram, em nenhuma hipótese.
 */

/** larguras aproximadas por tipo de conteúdo, para a planilha nascer legível */
const LARGURA_PADRAO = 18;

type Aba = {
  nome: string;
  /** rótulo humano da aba, aparece na capa */
  descricao: string;
  linhas: Record<string, unknown>[];
};

/** Achata valores que o Excel não sabe representar (JSON, boolean, data). */
function paraCelula(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor;
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (Array.isArray(valor) || typeof valor === "object") return JSON.stringify(valor);
  return valor as string | number;
}

function escreverAba(wb: ExcelJS.Workbook, aba: Aba) {
  // nome de aba no Excel: máx. 31 chars e sem : \ / ? * [ ]
  const planilha = wb.addWorksheet(aba.nome.replace(/[:\\/?*[\]]/g, "-").slice(0, 31));

  if (aba.linhas.length === 0) {
    planilha.addRow(["(sem registros)"]);
    return;
  }

  const colunas = Object.keys(aba.linhas[0]!);
  planilha.columns = colunas.map((c) => ({
    header: c,
    key: c,
    width: Math.max(c.length + 2, LARGURA_PADRAO),
  }));

  for (const linha of aba.linhas) {
    planilha.addRow(Object.fromEntries(colunas.map((c) => [c, paraCelula(linha[c])])));
  }

  // cabeçalho destacado e congelado — planilha com 3 mil linhas fica navegável
  const cabecalho = planilha.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cabecalho.height = 22;
  planilha.views = [{ state: "frozen", ySplit: 1 }];
  planilha.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colunas.length },
  };
}

/** Gera o .xlsx completo e devolve o buffer pronto para download. */
export async function gerarBackupExcel(opcoes: { incluirSenhas?: boolean } = {}) {
  const incluirSenhas = opcoes.incluirSenhas === true;

  const [
    linhasUsuarios,
    linhasPacotes,
    linhasAplicativos,
    linhasCombos,
    linhasContas,
    linhasAlocacoes,
    linhasFaturas,
    linhasPix,
    linhasAssinaturas,
    linhasChamados,
    linhasCarteiras,
    linhasComissoes,
    linhasSaques,
    linhasGift,
    linhasMovGift,
    linhasConfig,
  ] = await Promise.all([
    db.select().from(usuarios),
    db.select().from(pacotes),
    db.select().from(aplicativos),
    db.select().from(combos),
    db.select().from(contasMatrizes),
    db.select().from(alocacoes),
    db.select().from(faturas),
    db.select().from(cobrancasPix),
    db.select().from(assinaturas),
    db.select().from(chamados),
    db.select().from(carteiras),
    db.select().from(comissoes),
    db.select().from(saques),
    db.select().from(giftCards),
    db.select().from(movimentacoesGift),
    db.select().from(configuracoes),
  ]);

  const contasSeguras = linhasContas.map((c) => ({
    ...c,
    senha: incluirSenhas ? c.senha : "(oculta)",
  }));

  const abas: Aba[] = [
    { nome: "Clientes", descricao: "Cadastro de clientes e status de pagamento", linhas: linhasUsuarios },
    { nome: "Pacotes", descricao: "Pacotes vendidos na landing", linhas: linhasPacotes },
    { nome: "Aplicativos", descricao: "Catálogo de apps e preços", linhas: linhasAplicativos },
    { nome: "Combos", descricao: "Combos prontos", linhas: linhasCombos },
    { nome: "Contas matrizes", descricao: "Estoque de contas de streaming", linhas: contasSeguras },
    { nome: "Alocacoes", descricao: "Vínculo cliente ↔ conta matriz", linhas: linhasAlocacoes },
    { nome: "Faturas", descricao: "Financeiro por competência", linhas: linhasFaturas },
    { nome: "Cobrancas Pix", descricao: "Cobranças geradas no Pix", linhas: linhasPix },
    { nome: "Assinaturas cartao", descricao: "Recorrência no Mercado Pago", linhas: linhasAssinaturas },
    { nome: "Chamados", descricao: "Suporte", linhas: linhasChamados },
    { nome: "Carteiras", descricao: "Saldo de indicações", linhas: linhasCarteiras },
    { nome: "Comissoes", descricao: "Comissões apuradas", linhas: linhasComissoes },
    { nome: "Saques", descricao: "Pedidos de saque", linhas: linhasSaques },
    { nome: "Gift cards", descricao: "Gift cards emitidos", linhas: linhasGift },
    { nome: "Movimentacoes gift", descricao: "Uso dos gift cards", linhas: linhasMovGift },
    { nome: "Configuracoes", descricao: "Parâmetros do sistema", linhas: linhasConfig },
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = "PLAYPLUSNOW";
  wb.created = new Date();

  /* -------- capa: o que tem dentro, para o backup se explicar sozinho -------- */
  const capa = wb.addWorksheet("Resumo");
  capa.columns = [
    { header: "Aba", key: "aba", width: 24 },
    { header: "Conteúdo", key: "descricao", width: 44 },
    { header: "Registros", key: "total", width: 12 },
  ];
  capa.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  capa.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  capa.addRow({
    aba: "Backup gerado em",
    descricao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    total: "",
  });
  capa.addRow({
    aba: "Senhas das matrizes",
    descricao: incluirSenhas
      ? "INCLUÍDAS — trate este arquivo como confidencial"
      : "ocultas nesta exportação",
    total: "",
  });
  capa.addRow({});
  for (const aba of abas) {
    capa.addRow({ aba: aba.nome, descricao: aba.descricao, total: aba.linhas.length });
  }

  for (const aba of abas) escreverAba(wb, aba);

  const buffer = await wb.xlsx.writeBuffer();
  const data = new Date().toISOString().slice(0, 10);
  return {
    buffer: Buffer.from(buffer),
    nomeArquivo: `playplusnow-backup-${data}.xlsx`,
    totais: Object.fromEntries(abas.map((a) => [a.nome, a.linhas.length])),
  };
}

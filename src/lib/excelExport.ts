import ExcelJS from "exceljs";
import { db } from "./db";
import { DIAS_SEMANA } from "./datas";

const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const cinza: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };

const ROTULO_MODALIDADE: Record<string, string> = { DESIGNADO: "Designado", ACUMULACAO: "Acumulação", AUXILIO: "Auxílio" };
const ROTULO_TIPO: Record<string, string> = { TITULAR: "Titular", AUXILIAR: "Auxiliar", REGIONAL: "Regional", SUBSTITUTO: "Substituto" };
const ROTULO_ATUACAO: Record<string, string> = {
  TODAS: "Varas, auxiliares e plantão",
  CUSTODIA_PLANTAO: "Custódia e Plantão (sem varas)",
  CUSTODIA: "Somente Custódia",
  PLANTAO: "Somente Plantão",
};
const ROTULO_GRUPO: Record<string, string> = { CUSTODIA: "Custódia", AUDIENCIAS: "Audiências (varas)", PLANTAO: "Plantão" };
const ORDEM_TIPO = ["TITULAR", "AUXILIAR", "REGIONAL", "SUBSTITUTO"];

function titulo(ws: ExcelJS.Worksheet, texto: string) {
  const cell = ws.getCell(1, 1);
  cell.value = texto;
  cell.font = { bold: true, size: 13 };
}

function cabecalho(ws: ExcelJS.Worksheet, linha: number, textos: string[]) {
  textos.forEach((t, i) => {
    const cell = ws.getCell(linha, i + 1);
    cell.value = t;
    cell.font = { bold: true };
    cell.fill = cinza;
    cell.border = borda;
  });
}

function larguras(ws: ExcelJS.Worksheet, lista: number[]) {
  lista.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

export async function gerarWorkbookConfiguracoes(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();

  const portarias = await db.portaria.findMany({
    orderBy: [{ inicio: "asc" }, { id: "asc" }],
    include: {
      promotorAfastado: { select: { apelido: true, nome: true } },
      promotorCobridor: { select: { apelido: true, nome: true } },
    },
  });
  const wsAfa = wb.addWorksheet("Afastamentos", { views: [{ showGridLines: false }] });
  titulo(wsAfa, "PORTARIAS DE COBERTURA (AFASTAMENTOS)");
  cabecalho(wsAfa, 3, [
    "Nº Portaria",
    "Início",
    "Fim",
    "Afastado",
    "Nome do afastado",
    "Quem cobre",
    "Nome de quem cobre",
    "Modalidade",
    "Observação",
  ]);
  larguras(wsAfa, [14, 12, 12, 14, 36, 14, 36, 14, 36]);
  portarias.forEach((p, i) => {
    const r = 4 + i;
    wsAfa.getCell(r, 1).value = p.numero ?? "";
    wsAfa.getCell(r, 2).value = p.inicio;
    wsAfa.getCell(r, 3).value = p.fim;
    wsAfa.getCell(r, 4).value = p.promotorAfastado.apelido;
    wsAfa.getCell(r, 5).value = p.promotorAfastado.nome;
    wsAfa.getCell(r, 6).value = p.promotorCobridor?.apelido ?? "";
    wsAfa.getCell(r, 7).value = p.promotorCobridor?.nome ?? "";
    wsAfa.getCell(r, 8).value = ROTULO_MODALIDADE[p.modalidade] ?? p.modalidade;
    wsAfa.getCell(r, 9).value = p.observacao ?? "";
  });

  const trocas = await db.troca.findMany({
    orderBy: [{ data: "asc" }, { id: "asc" }],
    include: {
      posicao: { select: { codigo: true, nome: true } },
      promotorOrigem: { select: { apelido: true, nome: true } },
      promotorDestino: { select: { apelido: true, nome: true } },
    },
  });
  const wsTrocas = wb.addWorksheet("Trocas", { views: [{ showGridLines: false }] });
  titulo(wsTrocas, "TROCAS SOBRE A ESCALA");
  cabecalho(wsTrocas, 3, ["Data", "Posição", "Designado originalmente", "Nome", "Quem fica", "Nome", "Observação"]);
  larguras(wsTrocas, [14, 12, 24, 36, 24, 36, 40]);
  trocas.forEach((t, i) => {
    const r = 4 + i;
    wsTrocas.getCell(r, 1).value = t.data;
    wsTrocas.getCell(r, 2).value = t.posicao?.codigo ?? "";
    wsTrocas.getCell(r, 3).value = t.promotorOrigem?.apelido ?? "Vaga sem candidato";
    wsTrocas.getCell(r, 4).value = t.promotorOrigem?.nome ?? "";
    wsTrocas.getCell(r, 5).value = t.promotorDestino.apelido;
    wsTrocas.getCell(r, 6).value = t.promotorDestino.nome;
    wsTrocas.getCell(r, 7).value = t.observacao ?? "";
  });

  const promotores = await db.promotor.findMany({ include: { varas: true } });
  const cargos = await db.cargoAdministrativo.findMany();
  const cargoDe = new Map<number, string>();
  for (const c of cargos) if (c.promotorId) cargoDe.set(c.promotorId, c.cargo);
  const wsPro = wb.addWorksheet("Promotores", { views: [{ showGridLines: false }] });
  titulo(wsPro, "PROMOTORES");
  cabecalho(wsPro, 3, ["Apelido", "Nome", "E-mail", "Tipo", "Atuação", "Varas", "Ativo", "Genérico", "Cargo", "Observações"]);
  larguras(wsPro, [14, 38, 30, 12, 28, 12, 8, 10, 14, 50]);
  const ordenados = [...promotores].sort(
    (a, b) =>
      (ORDEM_TIPO.indexOf(a.tipo) - ORDEM_TIPO.indexOf(b.tipo)) || a.apelido.localeCompare(b.apelido)
  );
  ordenados.forEach((p, i) => {
    const r = 4 + i;
    const varasTxt = p.varas.length ? p.varas.map((v) => `${v.vara}ª`).sort().join(", ") : "Todas";
    const cargo = cargoDe.get(p.id);
    wsPro.getCell(r, 1).value = p.apelido;
    wsPro.getCell(r, 2).value = p.nome;
    wsPro.getCell(r, 3).value = p.email ?? "";
    wsPro.getCell(r, 4).value = ROTULO_TIPO[p.tipo] ?? p.tipo;
    wsPro.getCell(r, 5).value = ROTULO_ATUACAO[p.atuacao] ?? p.atuacao;
    wsPro.getCell(r, 6).value = varasTxt;
    wsPro.getCell(r, 7).value = p.ativo ? "Sim" : "Não";
    wsPro.getCell(r, 8).value = p.generico ? "Sim" : "Não";
    wsPro.getCell(r, 9).value = cargo === "SECRETARIO" ? "Secretário" : cargo === "SUBSECRETARIO" ? "Sub-secretário" : "";
    wsPro.getCell(r, 10).value = p.observacoes ?? "";
  });

  const regras = await db.regra.findMany({
    orderBy: { nome: "asc" },
    include: { promotores: { include: { promotor: { select: { apelido: true } } } } },
  });
  const wsReg = wb.addWorksheet("Regras", { views: [{ showGridLines: false }] });
  titulo(wsReg, "REGRAS");
  cabecalho(wsReg, 3, ["Regra", "Tipo", "Dias", "Grupos", "Promotores vinculados"]);
  larguras(wsReg, [34, 20, 26, 24, 44]);
  regras.forEach((r, i) => {
    const linha = 4 + i;
    const dias = r.diasCsv
      .split(",")
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((d) => DIAS_SEMANA[d]?.slice(0, 3) ?? String(d));
    const grupos = r.gruposCsv
      ? r.gruposCsv.split(",").filter(Boolean).map((g) => ROTULO_GRUPO[g] ?? g).join(", ")
      : "todos";
    wsReg.getCell(linha, 1).value = r.nome;
    wsReg.getCell(linha, 2).value = r.tipo === "EXCETO" ? "Exceto nestes dias" : "Somente nestes dias";
    wsReg.getCell(linha, 3).value = dias.join(", ");
    wsReg.getCell(linha, 4).value = grupos;
    wsReg.getCell(linha, 5).value = r.promotores.map((pv) => pv.promotor.apelido).join(", ");
  });

  const posicoes = await db.posicao.findMany({ orderBy: { ordem: "asc" } });
  const gradeItens = await db.gradeItem.findMany();
  const ativos = new Set(gradeItens.map((g) => `${g.diaSemana}|${g.posicaoId}`));
  const wsGrade = wb.addWorksheet("Grade", { views: [{ showGridLines: false }] });
  titulo(wsGrade, "GRADE DE POSIÇÕES");
  cabecalho(wsGrade, 3, ["Posição", "Nome", "Grupo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"]);
  larguras(wsGrade, [10, 34, 18, 9, 9, 9, 9, 9]);
  posicoes.forEach((p, i) => {
    const linha = 4 + i;
    wsGrade.getCell(linha, 1).value = p.codigo;
    wsGrade.getCell(linha, 2).value = p.nome;
    wsGrade.getCell(linha, 3).value = ROTULO_GRUPO[p.grupo] ?? p.grupo;
    [1, 2, 3, 4, 5].forEach((dia, j) => {
      const cell = wsGrade.getCell(linha, 4 + j);
      cell.value = p.codigo === "C" || ativos.has(`${dia}|${p.id}`) ? "X" : "";
      cell.alignment = { horizontal: "center" };
      cell.border = borda;
    });
  });
  let linhaGrupo = 4 + posicoes.length + 2;
  const titGrupo = wsGrade.getCell(linhaGrupo, 1);
  titGrupo.value = "CARGA PONDERADA POR GRUPO";
  titGrupo.font = { bold: true, size: 12 };
  linhaGrupo++;
  cabecalho(wsGrade, linhaGrupo, ["Grupo", "Peso"]);
  const grupos = await db.grupoCarga.findMany({ orderBy: { grupo: "asc" } });
  grupos.forEach((g, i) => {
    wsGrade.getCell(linhaGrupo + 1 + i, 1).value = ROTULO_GRUPO[g.grupo] ?? g.grupo;
    wsGrade.getCell(linhaGrupo + 1 + i, 2).value = g.peso;
  });

  const wsLeia = wb.addWorksheet("Leia-me");
  wsLeia.getColumn(1).width = 110;
  const notas = [
    "ESCALA PJ CRIMINAL — configurações exportadas em " + new Date().toLocaleString("pt-BR"),
    "Este arquivo dá uma visão geral das configurações do aplicativo.",
    "Afastamentos: portarias de cobertura. Pode ser importada de volta na tela \"Portarias\" (botão Importar Excel).",
    "Trocas/Ajustes: máscara aplicada sobre a escala original por dia e posição; permite trocar designações ou preencher vagas.",
    "Promotores: cadastro de promotores. Pode ser importado na tela \"Promotores\" (botão Importar Excel); linhas com apelido existente atualizam o cadastro, novas linhas criam promotores.",
    "Regras e Grade: somente leitura (consulta).",
    "Dicas para importar: mantenha a linha de cabeçalho; identifique os promotores pelo APELIDO; datas como AAAA-MM-DD ou DD/MM/AAAA;",
    "Ativo/Genérico: Sim ou Não; Varas: \"1ª, 3ª\" ou \"Todas\"; Tipo/Atuação/Modalidade aceitam os rótulos escritos aqui.",
  ];
  notas.forEach((t, i) => {
    const cell = wsLeia.getCell(i + 1, 1);
    cell.value = t;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 12 };
  });

  return wb;
}

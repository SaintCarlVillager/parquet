import ExcelJS from "exceljs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const APELIDO = "TESTE-IMP";
const ARQUIVO = "tmp-export.xlsx";

function falhou(msg) {
  console.error("FALHOU: " + msg);
  process.exit(1);
}

async function baixarExport() {
  const r = await fetch(BASE + "/api/configuracoes/export");
  if (!r.ok) falhou("export " + r.status + " " + (await r.text()));
  const buf = Buffer.from(await r.arrayBuffer());
  const fs = await import("node:fs");
  fs.writeFileSync(ARQUIVO, buf);
  return buf;
}

async function carregarWorkbook() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQUIVO);
  return wb;
}

function abaDe(wb, nome) {
  const ws = wb.getWorksheet(nome);
  if (!ws) falhou("aba ausente: " + nome);
  return ws;
}

function linhaTestePromotor(tipo) {
  return [APELIDO, "Teste Import Excel", "teste-imp@mpsp.mp.br", tipo, "Varas, auxiliares e plantao", "1a, 3a", "Sim", "Nao", "", "Observacoes E2E"];
}

async function enviarImportacao(url, buffer) {
  const fd = new FormData();
  fd.append("arquivo", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "arq.xlsx");
  const r = await fetch(BASE + url, { method: "POST", body: fd });
  return { status: r.status, dados: await r.json() };
}

async function main() {
  // 0. limpeza de execucao anterior, se houver
  const listaInicial = await (await fetch(BASE + "/api/promotores")).json();
  const anterior = listaInicial.find((p) => p.apelido === APELIDO);
  if (anterior) {
    const del0 = await fetch(BASE + "/api/promotores/" + anterior.id, { method: "DELETE" });
    if (!del0.ok) falhou("limpeza inicial delete " + del0.status);
    console.log("OK limpeza inicial: TESTE-IMP removido");
  }

  // 1. export
  await baixarExport();
  let wb = await carregarWorkbook();
  for (const nome of ["Afastamentos", "Promotores", "Regras", "Grade", "Leia-me"]) {
    if (!wb.getWorksheet(nome)) falhou("aba ausente no export: " + nome);
  }
  const wsPro = abaDe(wb, "Promotores");
  const wsAfa = abaDe(wb, "Afastamentos");
  let portariasDuplicadasEsperadas = 0;
  for (let r = 4; r <= wsAfa.rowCount; r++) {
    if (wsAfa.getCell(r, 2).value && wsAfa.getCell(r, 3).value && wsAfa.getCell(r, 4).value) portariasDuplicadasEsperadas++;
  }
  console.log("OK export: abas presentes; promotores rowCount=" + wsPro.rowCount + " portarias rowCount=" + wsAfa.rowCount);

  // 2. criar TESTE-IMP na aba Promotores (linha nova)
  const linhaPro = wsPro.rowCount + 1;
  linhaTestePromotor("Regional").forEach((v, i) => {
    wsPro.getCell(linhaPro, i + 1).value = v;
  });

  // 3. portaria de teste na aba Afastamentos
  const linhaAfa = wsAfa.rowCount + 1;
  wsAfa.getCell(linhaAfa, 1).value = "RT TESTE/2026";
  wsAfa.getCell(linhaAfa, 2).value = "2026-10-05";
  wsAfa.getCell(linhaAfa, 3).value = "2026-10-09";
  wsAfa.getCell(linhaAfa, 4).value = APELIDO;
  wsAfa.getCell(linhaAfa, 5).value = "Teste Import Excel";
  wsAfa.getCell(linhaAfa, 6).value = "";
  wsAfa.getCell(linhaAfa, 7).value = "";
  wsAfa.getCell(linhaAfa, 8).value = "Designado";
  wsAfa.getCell(linhaAfa, 9).value = "linha de teste";

  // 3b. linha com apelido inexistente (erro esperado)
  const linhaErro = wsAfa.rowCount + 1;
  wsAfa.getCell(linhaErro, 4).value = "NAOEXISTE-XYZ";
  wsAfa.getCell(linhaErro, 2).value = "2026-10-05";
  wsAfa.getCell(linhaErro, 3).value = "2026-10-06";

  let buf = await wb.xlsx.writeBuffer();
  await wb.xlsx.writeFile(ARQUIVO);

  // 4. import promotores -> criados 1
  let res = await enviarImportacao("/api/promotores/import", buf);
  if (res.status !== 200 || res.dados.criados !== 1 || res.dados.atualizados !== 0) {
    falhou("import promotores (criar): " + JSON.stringify(res.dados));
  }
  console.log("OK import promotores: criados=1");

  // 5. import novamente sem mudanca -> nada
  res = await enviarImportacao("/api/promotores/import", buf);
  if (res.status !== 200 || res.dados.criados !== 0 || res.dados.atualizados !== 0) {
    falhou("import promotores (sem mudanca): " + JSON.stringify(res.dados));
  }
  console.log("OK import promotores idempotente");

  // 6. mudar tipo -> atualizados 1
  const wb2 = await carregarWorkbook();
  const wsPro2 = abaDe(wb2, "Promotores");
  let achou = false;
  for (let r = 4; r <= wsPro2.rowCount; r++) {
    if (String(wsPro2.getCell(r, 1).value) === APELIDO) {
      wsPro2.getCell(r, 4).value = "Auxiliar";
      achou = true;
      break;
    }
  }
  if (!achou) falhou("linha TESTE-IMP ausente no workbook");
  res = await enviarImportacao("/api/promotores/import", await wb2.xlsx.writeBuffer());
  if (res.status !== 200 || res.dados.atualizados !== 1) {
    falhou("import promotores (atualizar): " + JSON.stringify(res.dados));
  }
  console.log("OK import promotores: atualizados=1");

  // 7. import portarias -> lote rejeitado: 0 criadas + 9 ignoradas + 1 erro
  res = await enviarImportacao("/api/portarias/import", buf);
  if (res.status !== 400 || res.dados.criados !== 0 || res.dados.ignorados !== portariasDuplicadasEsperadas) {
    falhou("import portarias: " + JSON.stringify(res.dados));
  }
  if (!res.dados.erros || res.dados.erros.length !== 1) falhou("import portarias erros: " + JSON.stringify(res.dados));
  console.log("OK import portarias atomica: criados=0, ignorados=" + portariasDuplicadasEsperadas + ", erros=1 (" + res.dados.erros[0].erro + ")");

  // 8. remover a linha invalida e importar o lote valido
  wsAfa.spliceRows(linhaErro, 1);
  const bufValido = await wb.xlsx.writeBuffer();
  res = await enviarImportacao("/api/portarias/import", bufValido);
  if (res.status !== 200 || res.dados.criados !== 1 || res.dados.ignorados !== portariasDuplicadasEsperadas) {
    falhou("import portarias valido: " + JSON.stringify(res.dados));
  }
  console.log("OK import portarias valido: criados=1, ignorados=" + portariasDuplicadasEsperadas);

  // 9. import portarias de novo -> nada novo
  res = await enviarImportacao("/api/portarias/import", bufValido);
  if (res.status !== 200 || res.dados.ignorados !== portariasDuplicadasEsperadas + 1 || res.dados.criados !== 0) {
    falhou("import portarias duplicada: " + JSON.stringify(res.dados));
  }
  console.log("OK import portarias idempotente");

  // 10. re-export contém os dados
  await baixarExport();
  wb = await carregarWorkbook();
  const wsPro3 = abaDe(wb, "Promotores");
  let achouPro = false;
  for (let r = 4; r <= wsPro3.rowCount; r++) {
    if (String(wsPro3.getCell(r, 1).value) === APELIDO) {
      const tipo = String(wsPro3.getCell(r, 4).value);
      const varas = String(wsPro3.getCell(r, 6).value);
      const observacoes = String(wsPro3.getCell(r, 10).value);
      if (tipo !== "Auxiliar") falhou("re-export tipo inesperado: " + tipo);
      if (!varas.includes("1") || !varas.includes("3")) falhou("re-export varas: " + varas);
      if (observacoes !== "Observacoes E2E") falhou("re-export observacoes: " + observacoes);
      achouPro = true;
      break;
    }
  }
  if (!achouPro) falhou("TESTE-IMP ausente no re-export");
  const wsAfa3 = abaDe(wb, "Afastamentos");
  let achouAfa = false;
  for (let r = 4; r <= wsAfa3.rowCount; r++) {
    if (String(wsAfa3.getCell(r, 4).value) === APELIDO) { achouAfa = true; break; }
  }
  if (!achouAfa) falhou("portaria de teste ausente no re-export");
  console.log("OK re-export com dados importados");

  // 10. limpeza: apagar promotor de teste (cascata remove portaria)
  const respLista = await fetch(BASE + "/api/promotores");
  const lista = await respLista.json();
  const alvo = lista.find((p) => p.apelido === APELIDO);
  if (!alvo) {
    console.log("DEBUG status=" + respLista.status + " total=" + lista.length);
    console.log("DEBUG apelidos=" + JSON.stringify(lista.map((p) => p.apelido)));
    falhou("promotor de teste nao encontrado para limpeza");
  }
  const portariasDoAlvo = (await (await fetch(BASE + "/api/portarias")).json()).portarias.filter(
    (p) => p.promotorAfastadoId === alvo.id || p.promotorCobridorId === alvo.id
  );
  for (const portaria of portariasDoAlvo) {
    const removida = await fetch(BASE + "/api/portarias/" + portaria.id, { method: "DELETE" });
    if (!removida.ok) falhou("limpeza portaria " + removida.status + " " + (await removida.text()));
  }
  const del = await fetch(BASE + "/api/promotores/" + alvo.id, { method: "DELETE" });
  if (!del.ok) falhou("limpeza delete " + del.status + " " + (await del.text()));
  const portarias = await (await fetch(BASE + "/api/portarias")).json();
  const restou = portarias.portarias.some((p) => p.promotorAfastadoId === alvo.id);
  if (restou) falhou("portaria de teste nao removida em cascata");
  console.log("OK limpeza: promotor e portaria de teste removidos");

  console.log("TODOS OS TESTES PASSARAM");
}

main().catch((e) => {
  console.error("ERRO INESPERADO", e);
  process.exit(1);
});

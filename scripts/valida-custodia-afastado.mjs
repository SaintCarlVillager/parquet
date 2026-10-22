import ExcelJS from "exceljs";

const b = "http://localhost:3000";
const ANO = 2026;
const MES = 9;
const fs = await import("node:fs");

const json = async (path, opts) => {
  const res = await fetch(b + path, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const post = (p, x) => json(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => json(p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const idEsc = async () => (await json("/api/escalas")).body.find((e) => e.mes === MES && e.ano === ANO).id;

let falhas = 0;
function checar(cond, msg) {
  console.log((cond ? "OK " : "FALHOU ") + msg);
  if (!cond) falhas++;
}

function diaSemana(iso) {
  return new Date(iso + "T00:00:00").getDay();
}
function impedeCustodia(p, iso, grupo) {
  for (const r of p.regras) {
    if (r.gruposCsv && !r.gruposCsv.split(",").includes(grupo)) continue;
    const dias = r.diasCsv.split(",").map(Number).filter((n) => !Number.isNaN(n));
    if (dias.length === 0) continue;
    if (r.tipo === "EXCETO") {
      if (dias.includes(diaSemana(iso))) return true;
    } else if (!dias.includes(diaSemana(iso))) return true;
  }
  return false;
}

for (const a of (await json("/api/portarias")).body.portarias.filter((x) => x.observacao === "Teste")) {
  await fetch(`${b}/api/portarias/${a.id}`, { method: "DELETE" });
}

let det = (await json(`/api/escalas/${await idEsc()}`)).body;
const posC = det.posicoes.find((p) => p.codigo === "C");
const desC = det.designacoes.filter((d) => d.posicaoId === posC.id).sort((x, y) => x.data.localeCompare(y.data));
const atuaC = (p) => ["TODAS", "CUSTODIA_PLANTAO", "CUSTODIA"].includes(p.atuacao);
const livres = det.promotores.filter(
  (p) => p.ativo && !p.generico && p.cargo === null && p.coberturas.length === 0 &&
    p.bloqueios.length === 0 && p.portarias.length === 0 && atuaC(p)
);
let p0, pCob, diaA, diaB;
externo: for (const a of livres) {
  for (const dia1 of desC.map((d) => d.data)) {
    if (impedeCustodia(a, dia1, posC.grupo) || desC.find((d) => d.data === dia1).travada) continue;
    for (const c of livres) {
      if (c.id === a.id) continue;
      const dia2 = desC.map((d) => d.data).find(
        (iso) => iso !== dia1 && !impedeCustodia(c, iso, posC.grupo) && !desC.find((d) => d.data === iso).travada
      );
      if (!dia2) continue;
      p0 = a; pCob = c; diaA = dia1; diaB = dia2;
      break externo;
    }
  }
}
checar(!!p0 && !!pCob, `par de titulares livre encontrado: ${p0?.apelido} (afastado) + ${pCob?.apelido} (cobridor)`);
if (!p0) process.exit(1);

const port = await post("/api/portarias", {
  numero: "RT TESTE/2026",
  promotorAfastadoId: p0.id,
  promotorCobridorId: pCob.id,
  modalidade: "ACUMULACAO",
  inicio: desC[0].data,
  fim: desC[desC.length - 1].data,
  observacao: "Teste",
});
checar(port.status === 201, `portaria de teste criada (${port.status} ${port.body?.erro ?? ""})`);

const celula = (dia) => det.designacoes.find((d) => d.posicaoId === posC.id && d.data === dia).id;

let r = await patch(`/api/designacoes/${celula(diaA)}`, { promotorId: p0.id });
checar(r.status === 200, `afastado ${p0.apelido} lancado na custodia ${diaA} (${r.status} ${r.body?.erro ?? ""})`);
r = await patch(`/api/designacoes/${celula(diaB)}`, { promotorId: pCob.id });
checar(r.status === 200, `cobridor ${pCob.apelido} lancado na custodia ${diaB} (${r.status} ${r.body?.erro ?? ""})`);

const desVara = det.designacoes.find((d) => /^\d/.test(d.posicao.codigo) && d.promotorId !== p0.id);
if (desVara) {
  r = await patch(`/api/designacoes/${desVara.id}`, { promotorId: p0.id });
  checar(r.status === 409, `afastado segue bloqueado fora da custodia (${r.status})`);
} else {
  console.log("AVISO: nenhuma posição de vara na escala para testar o bloqueio fora da custódia");
}

await post("/api/escalas", { ano: ANO, mes: MES });
det = (await json(`/api/escalas/${await idEsc()}`)).body;
const cust = (dia) => det.designacoes.find((d) => d.posicaoId === posC.id && d.data === dia).promotorId;
checar(cust(diaA) === p0.id, "custodia do afastado preservada apos regerar");
checar(cust(diaB) === pCob.id, "custodia do cobridor preservada apos regerar");
checar(det.promotores.find((p) => p.id === p0.id).portarias[0]?.numero === "RT TESTE/2026", "payload da escala expoe numero da portaria");

const exp = await fetch(`${b}/api/escalas/${await idEsc()}/export`);
checar(exp.ok, `export Excel (${exp.status})`);
fs.writeFileSync("tmp-custodia-afastado.xlsx", Buffer.from(await exp.arrayBuffer()));
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("tmp-custodia-afastado.xlsx");
const ws = wb.getWorksheet("Escala");
const rotulos = {};
let datasSemana = [];
for (let linha = 1; linha <= ws.rowCount; linha++) {
  const c1 = ws.getCell(linha, 1).value;
  const nums = [];
  for (let col = 2; col <= 6; col++) {
    const v = ws.getCell(linha, col).value;
    nums.push(typeof v === "number" ? v : null);
  }
  if (typeof c1 !== "string" && nums.some((n) => n !== null)) {
    datasSemana = nums;
    continue;
  }
  if (c1 === "C") {
    for (let i = 0; i < 5; i++) {
      const dia = datasSemana[i];
      if (typeof dia !== "number") continue;
      const iso = `${ANO}-${String(MES).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const v = ws.getCell(linha, i + 2).value;
      if (v && typeof v === "object" && v.richText) rotulos[iso] = v.richText.map((t) => t.text).join("");
    }
  }
}
checar((rotulos[diaA] ?? "").includes("afastado (portaria Nº RT TESTE/2026)"), `Excel dia ${diaA}: "${(rotulos[diaA] ?? "").split("\n").pop()}"`);
checar((rotulos[diaB] ?? "").includes(`acumulando ${p0.apelido}`), `Excel dia ${diaB}: "${(rotulos[diaB] ?? "").split("\n").pop()}"`);

await patch(`/api/designacoes/${celula(diaA)}`, { promotorId: null });
await patch(`/api/designacoes/${celula(diaB)}`, { promotorId: null });
await fetch(`${b}/api/portarias/${port.body.id}`, { method: "DELETE" });
await post("/api/escalas", { ano: ANO, mes: MES });
fs.unlinkSync("tmp-custodia-afastado.xlsx");

console.log(falhas === 0 ? "TUDO OK" : `${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

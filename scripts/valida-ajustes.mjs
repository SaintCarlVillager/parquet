const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const ExcelJS = (await import("exceljs")).default;

let r = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("regerar:", r.status);
const lista = await (await fetch(b + "/api/escalas")).json();
const esc = lista.find((e) => e.mes === 9 && e.ano === 2026);
const det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
const custodias = det.designacoes.filter((d) => d.posicao.codigo === "C");
const autoNull = det.designacoes.filter((d) => d.posicao.codigo !== "C" && !d.promotorId);
console.log("células C (esperado 21):", custodias.length, "| C sempre MANUAL (esperado true):", custodias.every((d) => d.origem === "MANUAL"));
// vagas em branco fora C acontecem quando nenhum PJ atende (regras/bloqueios/conflitos); ajuste manual pela grade
console.log("auto em branco fora C:", autoNull.length);
console.log("total:", det.designacoes.length);

r = await patch("/api/escalas/" + esc.id, { status: "PRONTA" });
const esperadoPronta = autoNull.length > 0 ? 409 : 200;
console.log(`PRONTA com ${autoNull.length} vaga(s) em branco (esperado ${esperadoPronta}):`, r.status);

const exp = await fetch(`${b}/api/escalas/${esc.id}/export`);
const buf = Buffer.from(await exp.arrayBuffer());
console.log("Excel:", exp.status, Math.round(buf.length / 1024) + " KB");
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const ws = wb.getWorksheet("Escala");
console.log("título:", ws.getCell(1, 1).value);
const labels = [];
ws.eachRow((row) => { const v = row.getCell(1).value; if (v) labels.push(String(v)); });
console.log("linhas de posição contêm C (esperado true):", labels.filter((v) => v === "C").length === 5);

r = await post("/api/escalas", { ano: 2026, mes: 10 });
const lista2 = await (await fetch(b + "/api/escalas")).json();
const out = lista2.find((e) => e.mes === 10 && e.ano === 2026);
r = await fetch(`${b}/api/escalas/${out.id}`, { method: "DELETE" });
console.log("excluir escala out/2026:", r.status);
const after = await fetch(`${b}/api/escalas/${out.id}`);
console.log("GET após excluir (esperado 404):", after.status);
console.log("FIM");

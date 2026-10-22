const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const tc = await post("/api/promotores", { nome: "Teste Só Custódia", apelido: "TESTE-C", atuacao: "CUSTODIA" });
const tp = await post("/api/promotores", { nome: "Teste Só Plantão", apelido: "TESTE-P", atuacao: "PLANTAO" });
console.log("criados:", tc.status, tp.status);
if (tc.status !== 201 || tp.status !== 201) { console.log("estado sujo: remova apelidos TESTE-* antes"); process.exit(1); }
const idC = (await tc.json()).id, idP = (await tp.json()).id;

await post("/api/escalas", { ano: 2026, mes: 9 });
let det = await (await fetch(b + "/api/escalas/" + (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9).id)).json();
const desC = det.designacoes.filter((d) => d.promotorId === idC);
const desP = det.designacoes.filter((d) => d.promotorId === idP);
console.log("TESTE-C auto (esperado 0, C é manual):", desC.length);
console.log("TESTE-P auto — só P (esperado true):", desP.length > 0 && desP.every((d) => d.posicao.codigo === "P"), "(" + desP.length + " plantões)");

const vara = det.designacoes.find((d) => d.posicao.codigo === "1" && d.promotorId !== idC);
const r1 = await patch("/api/designacoes/" + vara.id, { promotorId: idC });
console.log("TESTE-C em vara (esperado 409):", r1.status, (await r1.json()).erro);
const celulaC = det.designacoes.find((d) => d.posicao.codigo === "C");
const r2 = await patch("/api/designacoes/" + celulaC.id, { promotorId: idC });
console.log("TESTE-C em custódia (esperado 200):", r2.status);
await patch("/api/designacoes/" + celulaC.id, { promotorId: null });
const r3 = await patch("/api/designacoes/" + celulaC.id, { promotorId: idP });
console.log("TESTE-P em custódia (esperado 409):", r3.status, (await r3.json()).erro);
const plantaoLivre = det.designacoes.find((d) => d.posicao.codigo === "P" && d.promotorId !== idP);
const r4 = await patch("/api/designacoes/" + plantaoLivre.id, { promotorId: idP });
console.log("TESTE-P em plantão (esperado 200):", r4.status);

for (const d of det.designacoes.filter((x) => x.promotorId === idC || x.promotorId === idP)) {
  await patch("/api/designacoes/" + d.id, { promotorId: null });
}
await fetch(b + "/api/promotores/" + idC, { method: "DELETE" });
await fetch(b + "/api/promotores/" + idP, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
det = await (await fetch(b + "/api/escalas/" + (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9).id)).json();
console.log("cleanup: TESTE-C/P removidos (esperado true):", !det.promotores.some((p) => p.apelido.startsWith("TESTE")), "| total:", det.designacoes.length);
console.log("FIM");

const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const lista = await (await fetch(b + "/api/escalas")).json();
const esc = lista.find((e) => e.mes === 9);
let det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
const idC = det.promotores.find((p) => p.apelido === "TESTE-C")?.id;
const idP = det.promotores.find((p) => p.apelido === "TESTE-P")?.id;
console.log("testes ainda presentes:", Boolean(idC), Boolean(idP));
if (!idC || !idP) {
  console.log("valida-atuacao2 ignorado: dados ja limpos pelo validador anterior");
  process.exit(0);
}

const vara = det.designacoes.find((d) => d.posicao.codigo === "1" && d.promotorId !== idC);
const r1 = await patch("/api/designacoes/" + vara.id, { promotorId: idC });
console.log("TESTE-C em vara (esperado 409):", r1.status, (await r1.json()).erro);
const celulaC = det.designacoes.find((d) => d.posicao.codigo === "C");
const r2 = await patch("/api/designacoes/" + celulaC.id, { promotorId: idC });
console.log("TESTE-C em custódia (esperado 200):", r2.status);
await patch("/api/designacoes/" + celulaC.id, { promotorId: null });
const r3 = await patch("/api/designacoes/" + celulaC.id, { promotorId: idP });
console.log("TESTE-P em custódia (esperado 409):", r3.status, (await r3.json()).erro);
const plantao = det.designacoes.find((d) => d.posicao.codigo === "P" && d.data !== celulaC.data && d.promotorId !== idP);
const r4 = await patch("/api/designacoes/" + plantao.id, { promotorId: idP });
console.log("TESTE-P em plantão (esperado 200):", r4.status);

const d2 = await (await fetch(b + "/api/escalas/" + esc.id)).json();
for (const d of d2.designacoes.filter((x) => x.promotorId === idC || x.promotorId === idP)) {
  await patch("/api/designacoes/" + d.id, { promotorId: null });
}
await fetch(b + "/api/promotores/" + idC, { method: "DELETE" });
await fetch(b + "/api/promotores/" + idP, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
console.log("cleanup ok (esperado true):", !det.promotores.some((p) => p.apelido.startsWith("TESTE")), "| total:", det.designacoes.length);
console.log("FIM");

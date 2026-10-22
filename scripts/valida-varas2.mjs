const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const pj = await (await post("/api/promotores", { nome: "Teste Varas", apelido: "TESTE-V", varas: [1, 4, 6] })).json();
const esc = (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9);
const det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
const ocupados = new Set(det.designacoes.filter((d) => d.promotorId === pj.id).map((d) => d.data));

const v4 = det.designacoes.find((d) => d.posicao.codigo === "4" && !ocupados.has(d.data));
const r1 = await patch("/api/designacoes/" + v4.id, { promotorId: pj.id });
console.log("manual na 4ª Vara, dia livre (esperado 200):", r1.status);

const aux1 = det.designacoes.find((d) => d.posicao.codigo === "1'" && d.data !== v4.data && !ocupados.has(d.data));
const r2 = await patch("/api/designacoes/" + aux1.id, { promotorId: pj.id });
console.log("manual na 1ª auxiliar, dia livre (esperado 200):", r2.status);

const d2 = await (await fetch(b + "/api/escalas/" + esc.id)).json();
for (const d of d2.designacoes.filter((x) => x.promotorId === pj.id)) await patch("/api/designacoes/" + d.id, { promotorId: null });
await fetch(b + "/api/promotores/" + pj.id, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("cleanup ok:", !(await (await fetch(b + "/api/promotores")).json()).some((p) => p.apelido === "TESTE-V"));
console.log("FIM");

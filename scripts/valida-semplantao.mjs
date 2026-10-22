const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const escId = async () => (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9).id;
let r = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("regerar (qualquer status):", r.status);
let det = await (await fetch(b + "/api/escalas/" + (await escId()))).json();
console.log("designacoes:", det.designacoes.length);
console.log("sem chave plantoes (esperado true):", det.plantoes === undefined);

await patch("/api/escalas/" + (await escId()), { status: "PUBLICADA" });
r = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("regerar em PUBLICADA (esperado 201):", r.status);
det = await (await fetch(b + "/api/escalas/" + (await escId()))).json();
console.log("status apos regerar (esperado RASCUNHO):", det.escala.status);
console.log("designacoes:", det.designacoes.length);

const exp = await fetch(b + "/api/escalas/" + (await escId()) + "/export");
console.log("Excel:", exp.status);
console.log("FIM");

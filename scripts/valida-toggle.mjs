const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const l = await (await fetch(b + "/api/escalas")).json();
const e = l.find((x) => x.mes === 9 && x.ano === 2026);
const det = await (await fetch(b + "/api/escalas/" + e.id)).json();
const pos1l = det.posicoes.find((p) => p.codigo === "1'");

const ex = await (await post("/api/excecoes", { data: "2026-09-08", posicaoId: pos1l.id, ativa: false, motivo: "teste toggle" })).json();
console.log("excecao criada (ativa=false):", ex.ativa === false);

let r = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("regerar em RASCUNHO:", r.status);
let d2 = await (await fetch(b + "/api/escalas/" + e.id)).json();
console.log("total designacoes (esperado 245):", d2.designacoes.length);
console.log("1' em 08/09 ausente (esperado true):", !d2.designacoes.some((x) => x.data === "2026-09-08" && x.posicaoId === pos1l.id));

await patch("/api/escalas/" + e.id, { status: "PRONTA" });
r = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("regerar com PRONTA (esperado 201):", r.status);

await fetch(b + "/api/excecoes/" + ex.id, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
d2 = await (await fetch(b + "/api/escalas/" + e.id)).json();
console.log("apos limpar excecao, total (esperado 246):", d2.designacoes.length);
console.log("FIM");

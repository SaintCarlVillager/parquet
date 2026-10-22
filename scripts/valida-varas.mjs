const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const pj = await (await post("/api/promotores", { nome: "Teste Varas", apelido: "TESTE-V", varas: [1, 4, 6] })).json();
console.log("criado com varas 1,4,6:", JSON.stringify(pj.varas));

await post("/api/escalas", { ano: 2026, mes: 9 });
const esc = (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9);
let det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
const dele = det.designacoes.filter((d) => d.promotorId === pj.id);
const fora = dele.filter((d) => /^(\d)'?$/.test(d.posicao.codigo) && ![1, 4, 6].includes(Number(d.posicao.codigo[0])));
console.log("designações auto:", dele.length, "| varas permitidas:", dele.filter((d) => d.posicao.codigo === "1" || d.posicao.codigo === "4" || d.posicao.codigo === "6" || d.posicao.codigo === "1'" || d.posicao.codigo === "4'" || d.posicao.codigo === "6'").length, "| em vara proibida (esperado 0):", fora.length);

const vara2 = det.designacoes.find((d) => d.posicao.codigo === "2");
const r1 = await patch("/api/designacoes/" + vara2.id, { promotorId: pj.id });
console.log("manual na 2ª Vara (esperado 409):", r1.status, (await r1.json()).erro);
const vara4 = det.designacoes.find((d) => d.posicao.codigo === "4" && d.data !== vara2.data);
const r2 = await patch("/api/designacoes/" + vara4.id, { promotorId: pj.id });
console.log("manual na 4ª Vara (esperado 200):", r2.status);
const aux1 = det.designacoes.find((d) => d.posicao.codigo === "1'" && d.data !== vara4.data);
const r3 = await patch("/api/designacoes/" + aux1.id, { promotorId: pj.id });
console.log("manual na 1ª auxiliar (esperado 200):", r3.status);

const d2 = await (await fetch(b + "/api/escalas/" + esc.id)).json();
for (const d of d2.designacoes.filter((x) => x.promotorId === pj.id)) await patch("/api/designacoes/" + d.id, { promotorId: null });
await fetch(b + "/api/promotores/" + pj.id, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
det = await (await fetch(b + "/api/escalas/" + esc.id)).json();
console.log("cleanup ok:", !det.promotores.some((p) => p.apelido === "TESTE-V"), "| total:", det.designacoes.length);
console.log("FIM");

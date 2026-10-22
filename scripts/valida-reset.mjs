import { exigir } from "./assert.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const j = (r) => r.json();
const post = (p, x) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(base + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

await post("/api/escalas", { ano: 2026, mes: 9 });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.ano === 2026 && e.mes === 9);
exigir(esc, "escala de setembro nao encontrada");
const detalhe = async () => await j(await fetch(base + "/api/escalas/" + esc.id));
let d = await detalhe();
const totalAntes = d.designacoes.length;
const comPromotor = d.designacoes.filter((x) => x.promotorId).length;

const posC = d.posicoes.find((p) => p.codigo === "C");
exigir(posC, "posicao de custodia nao encontrada");
for (const c of d.designacoes.filter((x) => x.posicaoId === posC.id && x.promotorId)) {
  await patch("/api/designacoes/" + c.id, { promotorId: null });
}

const desC = d.designacoes.find((x) => x.posicaoId === posC.id);
const pj = d.promotores.find((p) => p.ativo && !p.generico);
exigir(pj, "promotor ativo nao encontrado");
const rLanc = await patch("/api/designacoes/" + desC.id, { promotorId: pj.id });
exigir(rLanc.ok, "lancar custodia manual antes do reset");

await patch("/api/escalas/" + esc.id, { status: "PRONTA" });

const r = await fetch(`${base}/api/escalas/${esc.id}/reset`, { method: "POST" });
const out = await j(r);
exigir(r.status === 200, `reset falhou: ${r.status} ${JSON.stringify(out)}`);
console.log("reset (200):", r.status, JSON.stringify(out));

d = await detalhe();
const restantes = d.designacoes.filter((x) => x.promotorId);
console.log("designacoes antes:", totalAntes, "| preenchidas antes:", comPromotor);
exigir(
  restantes.length >= 1 && restantes.every((x) => x.posicaoId === posC.id && x.promotorId === pj.id),
  "reset nao preservou somente a custodia lancada"
);
console.log("restantes preenchidas (esperado 1, a custodia):", restantes.length, "| posicao: C | PJ:", pj.apelido);
console.log("status apos reset (esperado RASCUNHO):", d.escala.status);
exigir(d.escala.status === "RASCUNHO", "status apos reset deveria ser RASCUNHO");

await post("/api/escalas", { ano: 2026, mes: 9 });
d = await detalhe();
const cDepois = d.designacoes.find((x) => x.id === desC.id);
exigir(cDepois && cDepois.promotorId === pj.id, "custodia manual nao preservada na regeneracao");
console.log("celula da custodia:", cDepois.data);
console.log("custodia preservada:", cDepois.promotorId === pj.id);

await patch("/api/designacoes/" + cDepois.id, { promotorId: null });
console.log("FIM");

import { exigir, exigirStatus } from "./assert.mjs";

const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const escala = (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9);
exigir(escala, "escala de setembro nao encontrada");
let det = await (await fetch(b + "/api/escalas/" + escala.id)).json();
const posC = det.posicoes.find((p) => p.codigo === "C");
exigir(posC, "posicao de custodia nao encontrada");
const dias = [...new Set(det.designacoes.filter((d) => d.posicaoId === posC.id).map((d) => d.data))].sort();
const promotores = det.promotores.filter((p) => p.ativo);

async function preencher(dia, pid) {
  const des = det.designacoes.find((d) => d.data === dia && d.posicaoId === posC.id);
  exigir(des, `custodia nao encontrada em ${dia}`);
  const r = await patch("/api/designacoes/" + des.id, { promotorId: pid });
  return r.status;
}

// preenche 3 dias com PJs distintos (varre candidatos até caber)
const preenchidos = {};
for (const dia of dias.slice(0, 3)) {
  for (const p of promotores) {
    if (Object.values(preenchidos).includes(p.id)) continue;
    const s = await preencher(dia, p.id);
    if (s === 200) { preenchidos[dia] = p.id; break; }
  }
}
exigir(Object.keys(preenchidos).length === 3, `dias de custodia preenchidos: esperado 3, recebido ${Object.keys(preenchidos).length}`);
console.log("dias preenchidos:", Object.keys(preenchidos).length, "(esperado 3)");

// regenera e confere preservação
exigirStatus(await fetch(b + `/api/escalas/${escala.id}/gerar`, { method: "POST" }), 200, "gerar escala preservando custodia");
det = await (await fetch(b + "/api/escalas/" + escala.id)).json();
let preservadas = 0;
for (const [dia, pid] of Object.entries(preenchidos)) {
  const des = det.designacoes.find((d) => d.data === dia && d.posicaoId === posC.id);
  if (des.promotorId === pid) preservadas++;
}
exigir(preservadas === 3, `custodias preservadas: esperado 3, recebido ${preservadas}`);
console.log("preservadas após regeneração (esperado 3):", preservadas);

// limpa
for (const dia of Object.keys(preenchidos)) {
  const des = det.designacoes.find((d) => d.data === dia && d.posicaoId === posC.id);
  exigirStatus(await patch("/api/designacoes/" + des.id, { promotorId: null }), 200, `limpar custodia ${dia}`);
}
console.log("FIM");

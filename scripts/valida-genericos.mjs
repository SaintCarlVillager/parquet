import { exigir, exigirStatus } from "./assert.mjs";

const base = "http://localhost:3000";
const j = (r) => r.json();
const json = { headers: { "Content-Type": "application/json" } };
const escalaResposta = await fetch(base + "/api/escalas", { ...json, method: "POST", body: JSON.stringify({ ano: 2026, mes: 9 }) });
exigirStatus(escalaResposta, 201, "preparar escala");
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.ano === 2026 && e.mes === 9);
exigir(esc, "escala de setembro nao encontrada");
exigirStatus(await fetch(`${base}/api/escalas/${esc.id}/gerar`, { method: "POST" }), 200, "gerar escala de setembro");
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const pjs = det.promotores.find((p) => p.apelido === "PJS");
exigir(pjs?.generico, "PJS deve ser generico");
console.log("PJS generico:", pjs.generico);
const posById = new Map(det.posicoes.map((p) => [p.id, p]));
const porData = new Map();
for (const d of det.designacoes) {
  if (d.posicao.codigo === "C") continue;
  porData.set(d.data, [...(porData.get(d.data) ?? []), d]);
}
const alvo = [...porData].sort(([a], [b]) => a.localeCompare(b)).find(([, celulas]) => celulas.length >= 2);
exigir(alvo, "duas posicoes de audiencia no mesmo dia nao encontradas");
const [data, celulasDia] = alvo;
const celulas = celulasDia.slice(0, 2);
const antes = celulas.map((c) => ({ id: c.id, dono: c.promotorId }));
const patch = (id, promotorId) => fetch(`${base}/api/designacoes/${id}`, { ...json, method: "PATCH", body: JSON.stringify({ promotorId }) });
const rCriar = await fetch(`${base}/api/promotores`, { ...json, method: "POST", body: JSON.stringify({ nome: "Teste Genérico E2E", apelido: `TESTE-GEN-${Date.now()}`, tipo: "TITULAR", atuacao: "TODAS" }) });
exigirStatus(rCriar, 201, "criar PJ nao generico de contraprova");
const normal = await j(rCriar);
try {
  for (const c of celulas) {
    const r = await patch(c.id, pjs.id);
    exigirStatus(r, 200, `PJS em ${data} ${posById.get(c.posicaoId).codigo}`);
    console.log(`PJS em ${data} ${posById.get(c.posicaoId).codigo}:`, r.status);
  }
  const r2 = await patch(celulas[0].id, normal.id);
  exigirStatus(r2, 200, "primeira designacao do PJ normal");
  const r3 = await patch(celulas[1].id, normal.id);
  exigirStatus(r3, 409, "segunda designacao do PJ normal no mesmo dia");
  console.log("PJ normal 2x no mesmo dia:", r3.status);
} finally {
  for (const c of celulas) await patch(c.id, antes.find((x) => x.id === c.id).dono);
  await fetch(`${base}/api/promotores/${normal.id}`, { method: "DELETE" });
}
console.log("FIM");

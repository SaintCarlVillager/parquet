const base = "http://localhost:3000";

async function json(path, opts) {
  const res = await fetch(base + path, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
}

const post = (path, body) => json(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patch = (path, body) => json(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const r1 = await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("POST /api/escalas:", r1.status);
if (r1.status !== 201) { console.log(JSON.stringify(r1.body)); process.exit(1); }
const escalaId = r1.body.id;

const det = (await json(`/api/escalas/${escalaId}`)).body;
const des = det.designacoes;
console.log("Designações:", des.length);

const promotorPorId = new Map(det.promotores.map((p) => [p.id, p]));
const semPromotor = des.filter((d) => !d.promotorId && d.posicao.codigo !== "C");
console.log("Vagas em branco fora C:", semPromotor.length);

const porDia = new Map();
for (const d of des) {
  if (!d.promotorId) continue;
  if (porDia.has(d.data)) porDia.get(d.data).push(d.promotorId);
  else porDia.set(d.data, [d.promotorId]);
}
let conflitos = 0;
for (const [dia, ids] of porDia) {
  const naoGenericos = ids.filter((id) => !promotorPorId.get(id).generico);
  if (new Set(naoGenericos).size !== naoGenericos.length) conflitos++;
}
console.log("Dias com conflito (PJ não genérico 2x):", conflitos);

const pesos = new Map(det.grupos.map((g) => [g.grupo, g.peso]));
const carga = new Map();
for (const d of des) {
  if (!d.promotorId) continue;
  const pos = det.posicoes.find((p) => p.id === d.posicaoId);
  const peso = pesos.get(pos.grupo) ?? 1;
  carga.set(d.promotorId, (carga.get(d.promotorId) ?? 0) + peso);
}
const vals = [...carga.values()].sort((a, b) => a - b);
const nomes = new Map(det.promotores.map((p) => [p.id, p.apelido]));
console.log("Carga min/max:", vals[0].toFixed(1), "/", vals[vals.length - 1].toFixed(1));

const alvoPortaria = det.promotores.find((p) => p.ativo && !p.generico && p.tipo !== "SUBSTITUTO" && !p.cargo);
const cobridor = det.promotores.find((p) => p.ativo && !p.generico && p.id !== alvoPortaria.id);
const pt = await post("/api/portarias", { numero: "TESTE-SM", promotorAfastadoId: alvoPortaria.id, promotorCobridorId: cobridor.id, modalidade: "ACUMULACAO", inicio: "2026-09-01", fim: "2026-09-30", observacao: "Teste" });
console.log("Portaria de teste:", pt.status);
await post("/api/escalas", { ano: 2026, mes: 9 });
const det2 = (await json(`/api/escalas/${escalaId}`)).body;
const desAfastado = det2.designacoes.filter((d) => d.promotorId === alvoPortaria.id && d.origem === "AUTO");
console.log("Designações AUTO do afastado após portaria (esperado 0):", desAfastado.length);
const livre = det2.designacoes.find((d) => d.posicao.codigo === "1" && d.promotorId !== alvoPortaria.id);
const bad = await patch(`/api/designacoes/${livre.id}`, { promotorId: alvoPortaria.id });
console.log("Designar afastado (esperado 409):", bad.status, bad.body?.erro);

const celulaC = det2.designacoes.find((d) => d.posicao.codigo === "C" && !d.promotorId);
// A API não devolve portarias/regras no payload de promotores; tenta candidatos
// em ordem até um passar (o algoritmo decide quem é elegível naquela data).
let ok = null;
for (const cand of det2.promotores.filter((p) => p.ativo && !p.generico && p.atuacao === "TODAS" && !det2.designacoes.some((d) => d.data === celulaC.data && d.promotorId === p.id))) {
  ok = await patch(`/api/designacoes/${celulaC.id}`, { promotorId: cand.id });
  if (ok.status === 200) break;
}
console.log("Lançar custódia manual (esperado 200):", ok.status, "origem:", ok.body?.origem);
await patch(`/api/designacoes/${celulaC.id}`, { promotorId: null });

const diaLivre = det2.designacoes.find((d) => d.posicao.codigo === "P" && d.promotorId !== null && d.promotorId !== ok.body?.promotorId);
const dono = ok.body?.promotorId ? det2.promotores.find((p) => p.id === ok.body.promotorId) : null;
const dup = dono && diaLivre ? det2.designacoes.find((d) => d.data === diaLivre.data && d.promotorId === dono.id) : null;
const conflito = dup && diaLivre ? await patch(`/api/designacoes/${diaLivre.id}`, { promotorId: dono.id }) : { status: "n/a (sem duplicar)" };
console.log("Duplicar no dia (esperado 409):", conflito.status, conflito.body?.erro ?? "");

const exp = await fetch(`${base}/api/escalas/${escalaId}/export`);
const buf = await exp.arrayBuffer();
console.log("Excel:", exp.status, Math.round(buf.byteLength / 1024) + " KB");

const brancasForaC = det2.designacoes.filter((d) => d.posicao.codigo !== "C" && !d.promotorId).length;
const pronta = await patch(`/api/escalas/${escalaId}`, { status: "PRONTA" });
console.log(`Marcar PRONTA (${brancasForaC} vaga(s) em branco → esperado ${brancasForaC ? 409 : 200}):`, pronta.status, pronta.body?.erro ?? pronta.body?.status ?? "");

await fetch(`${base}/api/portarias/${pt.body.id}`, { method: "DELETE" });
await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("FIM");

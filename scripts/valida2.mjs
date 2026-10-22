const base = "http://localhost:3000";
const json = async (path, opts) => { const res = await fetch(base + path, opts); return { status: res.status, body: await res.json().catch(() => null) }; };
const post = (p, b) => json(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const patch = (p, b) => json(p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

const lista = (await json("/api/escalas")).body;
const esc = lista.find((e) => e.mes === 9);
const det = (await json(`/api/escalas/${esc.id}`)).body;
const des = det.designacoes;
const promotorPorId = new Map(det.promotores.map((p) => [p.id, p]));
const ativos = det.promotores.filter((p) => p.ativo);

function disponivel(p, data, posId) {
  if (p.portarias?.some((a) => a.inicio <= data && data <= a.fim)) return false;
  if (p.bloqueios.some((b) => (b.posicaoId === null || b.posicaoId === posId) && (b.data === null || b.data === data))) return false;
  if (des.some((d) => d.data === data && d.promotorId === p.id)) return false;
  return true;
}

const diaSemana = (iso) => new Date(iso + "T00:00:00").getUTCDay();
const regraImpede = (regras, grupo, ds) => regras.some((r) => {
  if (r.gruposCsv !== "" && !r.gruposCsv.split(",").includes(grupo)) return false;
  const dias = r.diasCsv.split(",").map(Number);
  return r.tipo === "SOMENTE" ? !dias.includes(ds) : dias.includes(ds);
});
const atuaNaPosicao = (p, codigo) => {
  const m = /^(\d)'?$/.exec(codigo);
  if (!m) return true;
  const n = Number(m[1]);
  if ((codigo.endsWith("'") ? "AUXILIAR" : "TITULAR") !== p.tipo) return false;
  return p.varas.length === 0 || p.varas.includes(n);
};
const grupoDa = (d) => det.posicoes.find((x) => x.id === d.posicaoId).grupo;
// O teste valida o fluxo do ajuste manual (PATCH), não o algoritmo do gerador.
// O candidato pode ser qualquer promotor ativo em TODAS com a posição compatível:
// SUBSTITUTO e genéricos entram, pois o objetivo é exercitar o endpoint.
let d1, p1, original1;
for (const d of des.filter((d) => d.promotorId && !promotorPorId.get(d.promotorId).generico && d.posicao.codigo !== "C")) {
  const cand = ativos.find((p) => {
    if (p.id === d.promotorId || p.atuacao !== "TODAS") return false;
    if (!atuaNaPosicao(p, d.posicao.codigo) && !p.generico) return false;
    if (p.portarias?.some((a) => a.inicio <= d.data && d.data <= a.fim)) return false;
    if (p.bloqueios.some((b) => (b.posicaoId === null || b.posicaoId === d.posicaoId) && (b.data === null || b.data === d.data))) return false;
    return !des.some((x) => x.data === d.data && x.promotorId === p.id);
  });
  if (cand) { d1 = d; p1 = cand; original1 = d.promotorId; break; }
}
if (!d1) { console.log("sem par designação/candidato para o teste"); process.exit(1); }
const r1 = await patch(`/api/designacoes/${d1.id}`, { promotorId: p1.id });
console.log("Edição manual válida:", r1.status, "origem:", r1.body?.origem, r1.body?.erro ?? "");
const d2 = des.find((d) => d.data === d1.data && d.id !== d1.id && d.posicao.codigo !== "C" && d.promotorId !== p1.id && d.promotorId !== null && atuaNaPosicao(p1, d.posicao.codigo));
const original2 = d2?.promotorId;
const conflito = d2 ? await patch(`/api/designacoes/${d2.id}`, { promotorId: p1.id }) : { status: "n/a (sem segunda célula compatível)" };
console.log("Duplicar no dia (esperado 409):", conflito.status, conflito.body?.erro ?? "");

const exp = await fetch(`${base}/api/escalas/${esc.id}/export`);
const buf = await exp.arrayBuffer();
console.log("Excel:", exp.status, Math.round(buf.byteLength / 1024) + " KB");

const brancasForaC = des.filter((d) => d.posicao.codigo !== "C" && !d.promotorId).length;
const pronta = await patch(`/api/escalas/${esc.id}`, { status: "PRONTA" });
console.log(`Marcar PRONTA (${brancasForaC} vaga(s) em branco → esperado ${brancasForaC ? 409 : 200}):`, pronta.status, pronta.body?.erro ?? "");
if (pronta.status === 200) {
  console.log("Voltar a RASCUNHO:", (await patch(`/api/escalas/${esc.id}`, { status: "RASCUNHO" })).status);
}

const regen = await post("/api/escalas", { ano: esc.ano, mes: esc.mes });
console.log("Regerar em RASCUNHO (201, volta a RASCUNHO):", regen.status, regen.body.status);

// restaura o ajuste do teste e regenera para fechar consistente
await patch(`/api/designacoes/${d1.id}`, { promotorId: original1 });
await post("/api/escalas", { ano: esc.ano, mes: esc.mes });
console.log("FIM");

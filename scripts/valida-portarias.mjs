import { exigir, exigirStatus } from "./assert.mjs";

const base = "http://localhost:3000";
const json = async (path, opts) => { const res = await fetch(base + path, opts); return { status: res.status, body: await res.json().catch(() => null) }; };
const post = (p, b) => json(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

for (const a of (await json("/api/portarias")).body.portarias.filter((x) => x.observacao === "Teste")) {
  await fetch(`${base}/api/portarias/${a.id}`, { method: "DELETE" });
}

const lista = (await json("/api/escalas")).body;
const esc = lista.find((item) => item.ano === 2026 && item.mes === 9);
exigir(esc, "escala para teste de portarias nao encontrada");
await json(`/api/escalas/${esc.id}/reset`, { method: "POST" });
await json(`/api/escalas/${esc.id}/gerar`, { method: "POST" });
const det = (await json(`/api/escalas/${esc.id}`)).body;
// pega um TITULAR com atuação TODAS que tem designações (não REGIONAL/AUX nem SUBS)
const p0 = det.promotores.find((p) => p.ativo && p.tipo === "TITULAR" && p.atuacao === "TODAS" &&
  det.designacoes.some((d) => d.promotorId === p.id && d.posicao.codigo !== "C"));
exigir(p0, "alvo titular com designacoes nao encontrado");
console.log("alvo:", p0.apelido);
const designacaoInicial = det.designacoes.find((d) => d.promotorId === p0.id && d.posicao.codigo !== "C");
exigir(designacaoInicial, "designacao inicial do afastado nao encontrada");
const antes = det.designacoes.filter((d) => d.promotorId === p0.id && d.posicao.codigo !== "C").length;

// validações de API
let r = await post("/api/portarias", { numero: "X", promotorAfastadoId: p0.id, promotorCobridorId: p0.id, modalidade: "DESIGNADO", inicio: "2026-09-01", fim: "2026-09-10" });
exigirStatus(r, 400, "cobridor igual ao afastado");
console.log("cobridor = afastado (400):", r.status);
r = await post("/api/portarias", { numero: "X", promotorAfastadoId: p0.id, inicio: "2026-09-10", fim: "2026-09-01" });
exigirStatus(r, 400, "inicio posterior ao fim");
console.log("inicio > fim (400):", r.status);

const af = await post("/api/portarias", { numero: "RT TESTE/2026", promotorAfastadoId: p0.id, promotorCobridorId: null, modalidade: "DESIGNADO", inicio: "2026-09-01", fim: "2026-09-30", observacao: "Teste" });
exigirStatus(af, 201, "criar portaria");
exigir(af.body?.id, "criar portaria sem id");
console.log("criar portaria (201):", af.status);
await json(`/api/escalas/${esc.id}/gerar`, { method: "POST" });
const det2 = (await json(`/api/escalas/${esc.id}`)).body;
const doAfastado = det2.designacoes.filter((d) => d.promotorId === p0.id && d.posicao.codigo !== "C");
exigir(doAfastado.length === 0, `afastado ainda possui ${doAfastado.length} designacoes`);
console.log(`designações do afastado no período (antes ${antes}, esperado 0):`, doAfastado.length);

// edição manual no período → 409
const desDia = det2.designacoes.find((d) => d.id === designacaoInicial.id);
exigir(desDia && desDia.promotorId !== p0.id, "designacao original do afastado nao foi liberada");
r = await fetch(`${base}/api/designacoes/${desDia.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promotorId: p0.id }) });
exigirStatus(r, 409, "edicao manual de afastado");
console.log("manual para afastado (409):", r.status, (await r.json()).erro);

const del = await fetch(`${base}/api/portarias/${af.body.id}`, { method: "DELETE" });
exigirStatus(del, 200, "excluir portaria");
console.log("excluir portaria (200):", del.status);
await json(`/api/escalas/${esc.id}/gerar`, { method: "POST" });
const det3 = (await json(`/api/escalas/${esc.id}`)).body;
const deVolta = det3.designacoes.filter((d) => d.promotorId === p0.id && d.posicao.codigo !== "C");
console.log(`após excluir, designações do titular (antes ${antes}, redistribuição permitida):`, deVolta.length);
console.log("FIM");

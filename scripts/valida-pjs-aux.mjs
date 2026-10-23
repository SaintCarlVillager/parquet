import { exigir, exigirStatus } from "./assert.mjs";

const base = "http://localhost:3000";
const j = (r) => r.json();
await fetch(base + "/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.ano === 2026 && e.mes === 9);
exigir(esc, "escala de setembro de 2026 nao encontrada");
exigirStatus(await fetch(`${base}/api/escalas/${esc.id}/gerar`, { method: "POST" }), 200, "gerar escala de setembro");
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const codigo = (d) => det.posicoes.find((p) => p.id === d.posicaoId).codigo;
const pjs = det.promotores.find((p) => p.apelido === "PJS");
exigir(pjs?.generico, "PJS generico ativo nao encontrado");
function cobertoPeloPjs(d) {
  const c = codigo(d);
  const m = /^(\d)('?)$/.exec(c);
  if (!m) return false;
  return (pjs.coberturas ?? []).some((item) =>
    item.inicio <= d.data && d.data <= item.fim &&
    (!!item.afastadoAuxiliar === (m[2] === "'")) &&
    (!item.varas?.length || item.varas.includes(Number(m[1])))
  );
}
const reserva = det.designacoes.filter((d) => d.promotorId === pjs.id && d.origem === "AUTO" && /^\d'$/.test(codigo(d)) && !cobertoPeloPjs(d));
exigir(reserva.length === 0, "PJS nao deve reservar auxiliar sem portaria de cobertura");
console.log("auxiliares do PJS sem cobertura:", reserva.length);
const diasComAux = new Set(det.designacoes.filter((d) => /^\d'$/.test(codigo(d))).map((d) => d.data));
console.log("dias com auxiliares:", diasComAux.size);
console.log("FIM");

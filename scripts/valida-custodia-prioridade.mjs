import { exigir, exigirStatus } from "./assert.mjs";

const b = "http://localhost:3000";
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

async function detalhe() {
  const esc = (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9);
  exigir(esc, "escala de setembro nao encontrada");
  return await (await fetch(b + "/api/escalas/" + esc.id)).json();
}

let det = await detalhe();
const posC = det.posicoes.find((p) => p.codigo === "C");
exigir(posC, "posicao de custodia nao encontrada");

// escolhe um PJ não genérico com designação automática num dia útil
// (genéricos não têm limite diário: podem acumular posições mesmo com custódia)
const promotorPorId = new Map(det.promotores.map((p) => [p.id, p]));
const alvo = det.designacoes.find((d) => d.origem === "AUTO" && d.promotorId && d.posicao.codigo !== "C" && !promotorPorId.get(d.promotorId).generico);
exigir(alvo, "designacao automatica de PJ nao generico nao encontrada");
const pid = alvo.promotorId;
const dia = alvo.data;
const codigoOriginal = alvo.posicao.codigo;
const apelido = det.promotores.find((p) => p.id === pid).apelido;
console.log(`alvo: ${apelido} em ${dia} (${codigoOriginal})`);

// 1. lança custódia para o MESMO PJ no MESMO dia — antes: 409; agora: 200
const desC = det.designacoes.find((d) => d.data === dia && d.posicaoId === posC.id);
exigir(desC, "custodia nao encontrada no dia do alvo");
const r1 = await patch("/api/designacoes/" + desC.id, { promotorId: pid });
exigirStatus(r1, 200, "lancar custodia sobre dia ocupado");
console.log("lançar custódia sobre dia ocupado (esperado 200):", r1.status, r1.ok ? "" : (await r1.json()).erro);

// 2. regenera: o motor não deve dar vara ao PJ no dia da custódia; conflito some
await fetch(b + `/api/escalas/${det.escala.id}/gerar`, { method: "POST" });
det = await detalhe();
const doDia = det.designacoes.filter((d) => d.data === dia && d.promotorId === pid);
exigir(doDia.length === 1 && doDia[0].posicaoId === posC.id, "PJ manteve designacao automatica junto com custodia");
console.log("designações do PJ no dia da custódia após regeneração (esperado 1, a própria C):", doDia.length, doDia.map((d) => det.posicoes.find((p) => p.id === d.posicaoId).codigo).join(","));
const cDia = det.designacoes.find((d) => d.data === dia && d.posicaoId === posC.id);
exigir(cDia?.promotorId === pid, "custodia nao foi preservada");
console.log("custódia preservada:", cDia.promotorId === pid);

// 3. agora designar esse PJ numa vara NO dia da custódia deve dar 409
const varaNoDia = det.designacoes.find((d) => d.data === dia && d.posicao.codigo === "1" && d.promotorId !== pid);
exigir(varaNoDia, "vara livre para testar conflito nao encontrada");
const r3 = await patch("/api/designacoes/" + varaNoDia.id, { promotorId: pid });
exigirStatus(r3, 409, "vara no dia da custodia");
console.log("vara no dia com custódia (esperado 409):", r3.status, (await r3.json()).erro);

// limpa a custódia de teste e regenera para restaurar o estado
await patch("/api/designacoes/" + cDia.id, { promotorId: null });
await fetch(b + `/api/escalas/${det.escala.id}/gerar`, { method: "POST" });
console.log("FIM");

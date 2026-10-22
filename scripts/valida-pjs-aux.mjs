const base = "http://localhost:3000";
const j = (r) => r.json();
await fetch(base + "/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const codigo = (d) => det.posicoes.find((p) => p.id === d.posicaoId).codigo;
const genericos = new Set(det.promotores.filter((p) => p.generico).map((p) => p.id));
const pjs = det.promotores.find((p) => p.apelido === "PJS");
const diasComAux = new Map();
for (const d of det.designacoes) {
  if (!/^\d'$/.test(codigo(d))) continue;
  const lista = diasComAux.get(d.data) ?? [];
  lista.push(d);
  diasComAux.set(d.data, lista);
}
let diasOk = 0, diasSemPjs = 0, foraAux = [];
for (const [data, auxs] of diasComAux) {
  const dePjs = auxs.filter((d) => d.promotorId === pjs.id);
  if (dePjs.length === 1) diasOk++;
  else { diasSemPjs++; console.log(data + ": PJS em " + dePjs.length + " auxiliar(es)"); }
}
for (const d of det.designacoes) {
  if (!d.promotorId || !genericos.has(d.promotorId)) continue;
  if (!/^\d'$/.test(codigo(d))) foraAux.push(d.data + "(" + codigo(d) + ")");
}
console.log("dias com auxiliares:", diasComAux.size, "| PJS em exatamente 1 auxiliar:", diasOk, "| exce��es:", diasSemPjs);
// informativo: genéricos podem aparecer fora das auxiliares por herança de portaria (cobertura)
// ou por custódia manual (C) — o contrato principal é "no máximo 1 auxiliar própria por dia"
console.log("posições de genéricos fora das auxiliares (herança de portaria/custódia):", foraAux.length ? foraAux.join(", ") : "nenhuma");
const cargaPjs = det.designacoes.filter((d) => d.promotorId === pjs.id).length;
console.log("total de designa��es do PJS no m�s:", cargaPjs);
console.log("FIM");

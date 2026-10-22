const base = "http://localhost:3000";
const j = (r) => r.json();
const put = (p, b) => fetch(base + p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const segundaDe = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

const promotores = await j(await fetch(base + "/api/promotores"));
const sec = promotores.find((p) => p.apelido === "02PJ");
const sub = promotores.find((p) => p.apelido === "01PJ");
console.log("secret�rio:", sec.apelido, sec.nome, "| sub tempor�rio:", sub.apelido);

// define cargos
let r = await put("/api/cargos", { SECRETARIO: sec.id, SUBSECRETARIO: sub.id });
console.log("cargos:", JSON.stringify(await j(r)));
r = await put("/api/cargos", { SECRETARIO: sec.id, SUBSECRETARIO: sec.id });
console.log("mesmo PJ nos dois cargos (400):", r.status);

// regenera e confere: secret�rio com no m�x. 1 audi�ncia por semana
await post("/api/escalas", { ano: 2026, mes: 9 });
let esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
let det = await j(await fetch(base + "/api/escalas/" + esc.id));
const grupoAud = (d) => det.posicoes.find((p) => p.id === d.posicaoId).grupo;
const auds = det.designacoes.filter((d) => d.promotorId === sec.id && grupoAud(d) === "AUDIENCIAS");
const porSemana = new Map();
for (const d of auds) porSemana.set(segundaDe(d.data), (porSemana.get(segundaDe(d.data)) ?? 0) + 1);
console.log("audi�ncias do secret�rio:", auds.length, "| semanas:", [...porSemana.values()].join(","), "(todas <=1:", [...porSemana.values()].every((n) => n <= 1) + ")");

// manual: 2� audi�ncia do secret�rio na mesma semana ? 409
const primeiraAud = det.designacoes.find((d) => d.posicao.grupo === "AUDIENCIAS");
const semanaOcup = [...porSemana.keys()][0] ?? (primeiraAud ? segundaDe(primeiraAud.data) : null);
const outraAud = semanaOcup ? det.designacoes.find((d) => d.posicao.grupo === "AUDIENCIAS" && segundaDe(d.data) === semanaOcup && d.promotorId !== sec.id) : null;
if (outraAud) {
  r = await fetch(`${base}/api/designacoes/${outraAud.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promotorId: sec.id }) });
  console.log("manual 2� audi�ncia na semana (409):", r.status, (await j(r)).erro);
} else {
  console.log("manual 2� audi�ncia na semana: sem vaga compativel");
}

// portaria: secret�rio ausente 01-15/09, cobridor = 06PJ; sub assume a fun��o
const cobridor = promotores.find((p) => p.apelido === "06PJ");
r = await post("/api/portarias", { numero: "TESTE-SEC", promotorAfastadoId: sec.id, promotorCobridorId: cobridor.id, modalidade: "DESIGNADO", inicio: "2026-09-01", fim: "2026-09-15", observacao: "Teste" });
const pt = await j(r);
console.log("portaria do secret�rio (201):", r.status);
await post("/api/escalas", { ano: 2026, mes: 9 });
esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
det = await j(await fetch(base + "/api/escalas/" + esc.id));
const noPeriodo = (d) => d.data >= "2026-09-01" && d.data <= "2026-09-15";
// sub: no m�x 1/semana no per�odo
const audsSub = det.designacoes.filter((d) => d.promotorId === sub.id && grupoAud(d) === "AUDIENCIAS" && noPeriodo(d));
const subSemanas = new Map();
for (const d of audsSub) subSemanas.set(segundaDe(d.data), (subSemanas.get(segundaDe(d.data)) ?? 0) + 1);
console.log("audi�ncias do SUB no per�odo:", audsSub.length, "| por semana:", [...subSemanas.values()].join(","), "(todas <=1:", [...subSemanas.values()].every((n) => n <= 1) + ")");
// cobridor: audi�ncias da 2PJ sem limite semanal
const varasSec = sec.varas.length ? sec.varas : null;
const audsCobr = det.designacoes.filter((d) => d.promotorId === cobridor.id && grupoAud(d) === "AUDIENCIAS" && noPeriodo(d));
const cobrSemanas = new Map();
for (const d of audsCobr) cobrSemanas.set(segundaDe(d.data), (cobrSemanas.get(segundaDe(d.data)) ?? 0) + 1);
console.log("audi�ncias do COBRIDOR no per�odo:", audsCobr.length, "| por semana:", [...cobrSemanas.values()].join(","), "(pode ter >1/semana)");
const nasVarasSec = varasSec ? audsCobr.every((d) => varasSec.includes(Number(/^(\d)'?$/.exec(det.posicoes.find((p) => p.id === d.posicaoId).codigo)[1]))) : true;
console.log("audi�ncias do cobridor nas varas do secret�rio:", nasVarasSec);
// secret�rio fora do per�odo
const audsSec2 = det.designacoes.filter((d) => d.promotorId === sec.id && grupoAud(d) === "AUDIENCIAS");
console.log("audi�ncias do secret�rio no per�odo (esperado 0):", audsSec2.filter(noPeriodo).length);

// limpeza
await fetch(`${base}/api/portarias/${pt.id}`, { method: "DELETE" });
await put("/api/cargos", { SECRETARIO: sec.id, SUBSECRETARIO: null });
await post("/api/escalas", { ano: 2026, mes: 9 });
console.log("FIM (secret�rio mantido = 2PJ; sub removido)");

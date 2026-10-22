const base = "http://localhost:3000";
const j = (r) => r.json();
const segundaDe = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const promotores = await j(await fetch(base + "/api/promotores"));
const nomes = Object.fromEntries(promotores.map((p) => [p.id, p.apelido]));
console.log("id 1 =", nomes[1], "| id 2 =", nomes[2], "| daviguimaraes id =", promotores.find((p) => p.apelido === "daviguimaraes")?.id);
const sec = promotores.find((p) => p.id === 2);
const sub = promotores.find((p) => p.id === 1);
const davi = promotores.find((p) => p.apelido === "daviguimaraes");
// setup: garante os cargos (o valida-secretario anterior remove o SUBSECRETARIO na limpeza)
await fetch(base + "/api/cargos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ SECRETARIO: sec.id, SUBSECRETARIO: sub.id }) });
// portaria correta: secretário ausente, Davi cobre
const r = await j(await fetch(base + "/api/portarias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero: "TESTE-SEC2", promotorAfastadoId: sec.id, promotorCobridorId: davi.id, modalidade: "DESIGNADO", inicio: "2026-09-01", fim: "2026-09-15", observacao: "Teste secretario" }) }));
console.log("portaria criada, id:", r.id);
await fetch(base + "/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const grupo = (d) => det.posicoes.find((p) => p.id === d.posicaoId).grupo;
const noPeriodo = (d) => d.data >= "2026-09-01" && d.data <= "2026-09-15";
const audsSub = det.designacoes.filter((d) => d.promotorId === sub.id && grupo(d) === "AUDIENCIAS" && noPeriodo(d));
const s = new Map();
for (const d of audsSub) s.set(segundaDe(d.data), (s.get(segundaDe(d.data)) ?? 0) + 1);
console.log("SUB", sub.apelido, "no per�odo:", audsSub.length, "audi�ncias | por semana:", [...s.values()].join(","), "| todas <=1:", [...s.values()].every((n) => n <= 1));
const audsSec = det.designacoes.filter((d) => d.promotorId === sec.id && noPeriodo(d));
console.log("SECRET�RIO no per�odo (esperado 0):", audsSec.length);
const audsDavi = det.designacoes.filter((d) => d.promotorId === davi.id && grupo(d) === "AUDIENCIAS" && noPeriodo(d));
const sd = new Map();
for (const d of audsDavi) sd.set(segundaDe(d.data), (sd.get(segundaDe(d.data)) ?? 0) + 1);
console.log("COBRIDOR", davi.apelido, "no per�odo:", audsDavi.length, "audi�ncias | por semana:", [...sd.values()].join(","), "(sem limite)");
// limpeza: remove portaria de teste, restitui cargos e regenera
await fetch(`${base}/api/portarias/${r.id}`, { method: "DELETE" });
await fetch(base + "/api/cargos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ SECRETARIO: sec.id, SUBSECRETARIO: null }) });
await fetch(base + "/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
console.log("FIM");

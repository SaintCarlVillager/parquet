const base = "http://localhost:3000";
const j = (r) => r.json();
await fetch(base + "/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const grupo = (d) => det.posicoes.find((p) => p.id === d.posicaoId).grupo;
const anterior = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const audPorPj = new Map();
for (const d of det.designacoes) {
  if (!d.promotorId || grupo(d) !== "AUDIENCIAS") continue;
  const s = audPorPj.get(d.promotorId) ?? new Set();
  s.add(d.data);
  audPorPj.set(d.promotorId, s);
}
const coberturasPorPj = new Map(det.promotores.map((p) => [p.id, p.coberturas ?? []]));
let total = 0, comCobertura = 0, fallback = 0;
for (const [pid, datas] of audPorPj) {
  for (const data of datas) {
    if (datas.has(anterior(data))) {
      total++;
      const cobs = coberturasPorPj.get(pid) ?? [];
      const cobre = cobs.some((c) => c.inicio <= data && data <= c.fim);
      if (cobre) comCobertura++; else fallback++;
      console.log(det.promotores.find((p) => p.id === pid).apelido + ": " + anterior(data) + " e " + data + (cobre ? " (cobertura/portaria)" : " (FALLBACK)"));
    }
  }
}
console.log("TOTAL pares consecutivos:", total, "| com cobertura:", comCobertura, "| fallback:", fallback);
console.log("FIM");

const base = process.env.BASE_URL ?? "http://localhost:3000";

async function json(url, options) {
  const resposta = await fetch(base + url, options);
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(`${options?.method ?? "GET"} ${url}: ${resposta.status} ${JSON.stringify(corpo)}`);
  return corpo;
}

let escalas = await json("/api/escalas");
let escala = escalas.find((item) => item.ano === 2026 && item.mes === 9);
if (!escala) {
  escala = await json("/api/escalas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ano: 2026, mes: 9 }) });
}
await json(`/api/escalas/${escala.id}/gerar`, { method: "POST" });
console.log(`escala 2026-09 preparada: ${escala.id}`);

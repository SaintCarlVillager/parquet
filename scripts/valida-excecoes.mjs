const base = "http://localhost:3000";
const g = await (await fetch(base + "/api/grade")).json();
const pos1 = g.posicoes.find((p) => p.codigo === "1");
const excecaoAntes = g.excecoes.find((e) => e.data === "2026-09-15" && e.posicaoId === pos1.id);
if (excecaoAntes) { console.log("exceção pré-existente em 15/09 pos 1 — removendo teste"); await fetch(`${base}/api/excecoes/${excecaoAntes.id}`, { method: "DELETE" }); }
// terça 15/09: posição 1 ativa no padrão? template terça
const ativaTemplate = g.gradeItens.some((gi) => gi.diaSemana === 2 && gi.posicaoId === pos1.id);
console.log("posição 1 na terça (padrão):", ativaTemplate);
// desliga ? cria exceção ativa=false
let r = await fetch(base + "/api/excecoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "2026-09-15", posicaoId: pos1.id, ativa: false, motivo: "Teste" }) });
const exc = await r.json();
console.log("desligar (201):", r.status, "ativa:", exc.ativa);
// liga de volta ? como é igual ao padrão, DELETE remove
r = await fetch(`${base}/api/excecoes/${exc.id}`, { method: "DELETE" });
console.log("voltar ao padrão (200):", r.status);
const g2 = await (await fetch(base + "/api/grade")).json();
console.log("exceção removida:", !g2.excecoes.some((e) => e.id === exc.id));
// ativar posição que não está no padrão (sexta sem 1? verifica sexta)
const ativaSexta = g2.gradeItens.some((gi) => gi.diaSemana === 5 && gi.posicaoId === pos1.id);
r = await fetch(base + "/api/excecoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: "2026-09-18", posicaoId: pos1.id, ativa: !ativaSexta, motivo: "Teste ativa" }) });
const exc2 = await r.json();
console.log("exceção oposta ao padrão (201):", r.status, "ativa:", exc2.ativa, "(padrão sexta:", ativaSexta + ")");
await fetch(`${base}/api/excecoes/${exc2.id}`, { method: "DELETE" });
console.log("FIM");

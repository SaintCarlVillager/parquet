import { exigir, exigirStatus } from "./assert.mjs";

const b = "http://localhost:3000";
const j = (r) => r.json();
const post = (p, x) => fetch(b + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const put = (p, x) => fetch(b + p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const del = (p) => fetch(b + p, { method: "DELETE" });
const diaSemana = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

// alvo próprio: TITULAR sem regras/varas/portarias, criado e removido pelo teste
// (regras de PJs distintos se combinam; usar um PJ real sujaria o teste)
const r0 = await post("/api/promotores", { nome: "Teste Regras", apelido: "TESTE-R", tipo: "TITULAR", atuacao: "TODAS" });
exigirStatus(r0, 201, "criar alvo TESTE-R");
console.log("criar alvo TESTE-R (201):", r0.status);
if (r0.status !== 201) { console.log("estado sujo: remova apelidos TESTE-* antes"); process.exit(1); }
const alvo = await j(r0);
try {
  // 1. cria a regra: AUDIENCIAS somente TER(2)/QUI(4), vinculada ao alvo
  let r = await post("/api/regras", { nome: "TESTE Varas só ter/qui", tipo: "SOMENTE", dias: [2, 4], grupos: ["AUDIENCIAS"], promotoresIds: [alvo.id] });
  exigirStatus(r, 201, "criar regra");
  const regra = await j(r);
  console.log("criar regra (201):", r.status);

  // validação: sem dias → 400
  r = await post("/api/regras", { nome: "X", tipo: "SOMENTE", dias: [], grupos: [], promotoresIds: [] });
  exigirStatus(r, 400, "regra sem dias");
  console.log("regra sem dias (400):", r.status);

  // 2. regenera setembro e verifica
  await post("/api/escalas", { ano: 2026, mes: 9 });
  let esc = (await j(await fetch(b + "/api/escalas"))).find((e) => e.ano === 2026 && e.mes === 9);
  exigir(esc, "escala de setembro nao encontrada");
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/reset", { method: "POST" }), 200, "limpar designacoes antes da regra");
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/gerar", { method: "POST" }), 200, "gerar designacoes apos criar regra");
  let det = await j(await fetch(b + "/api/escalas/" + esc.id));
  const des = det.designacoes.filter((d) => d.promotorId === alvo.id);
  const audiencias = des.filter((d) => det.posicoes.find((p) => p.id === d.posicaoId).grupo === "AUDIENCIAS");
  exigir(audiencias.every((d) => [2, 4].includes(diaSemana(d.data))), "audiencia fora de terca/quinta");
  // A regra é vinculada ao grupo AUDIENCIAS: restringe só audiências, não impede plantão.
  const outros = des.filter((d) => det.posicoes.find((p) => p.id === d.posicaoId).grupo !== "AUDIENCIAS" && det.posicoes.find((p) => p.id === d.posicaoId).grupo !== "PLANTAO");
  exigir(outros.length === 0, `alvo possui ${outros.length} designacoes fora de audiencias e plantao`);
  console.log("designações do alvo:", des.length, "| audiências:", audiencias.length, "| outros grupos (sem plantão):", outros.length);
  console.log("audiências só ter/qui (esperado true):", audiencias.every((d) => [2, 4].includes(diaSemana(d.data))));

  const varaBloqueada = det.designacoes.find((d) => det.posicoes.find((p) => p.id === d.posicaoId)?.grupo === "AUDIENCIAS" && ![2, 4].includes(diaSemana(d.data)) && d.promotorId !== alvo.id);
  exigir(varaBloqueada, "posicao de audiencia em dia bloqueado pela regra nao encontrada");
  r = await patch("/api/designacoes/" + varaBloqueada.id, { promotorId: alvo.id });
  exigirStatus(r, 409, "manual violando regra");
  console.log("manual violando regra (409):", r.status, (await j(r)).erro);

  // 4. PUT muda para somente SEG(1)/QUA(3)/SEX(5) → regenera → audiências apenas nesses dias
  r = await put("/api/regras/" + regra.id, { nome: regra.nome, tipo: "SOMENTE", dias: [1, 3, 5], grupos: ["AUDIENCIAS"], promotoresIds: [alvo.id] });
  exigirStatus(r, 200, "editar regra");
  console.log("editar regra (200):", r.status);
  await post("/api/escalas", { ano: 2026, mes: 9 });
  esc = (await j(await fetch(b + "/api/escalas"))).find((e) => e.ano === 2026 && e.mes === 9);
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/reset", { method: "POST" }), 200, "limpar designacoes antes da regra editada");
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/gerar", { method: "POST" }), 200, "gerar apos editar regra");
  det = await j(await fetch(b + "/api/escalas/" + esc.id));
  const aud2 = det.designacoes.filter((d) => d.promotorId === alvo.id && det.posicoes.find((p) => p.id === d.posicaoId).grupo === "AUDIENCIAS");
  const fora2 = aud2.filter((d) => ![1, 3, 5].includes(diaSemana(d.data)));
  if (fora2.length > 0) console.log("DEBUG fora:", JSON.stringify(fora2.map((d) => ({ data: d.data, ds: diaSemana(d.data), origem: d.origem, codigo: det.posicoes.find((p) => p.id === d.posicaoId).codigo }))));
  exigir(aud2.every((d) => [1, 3, 5].includes(diaSemana(d.data))), "audiencia fora de segunda/quarta/sexta");
  console.log("audiências só seg/qua/sex (esperado true):", aud2.length > 0 && aud2.every((d) => [1, 3, 5].includes(diaSemana(d.data))));

  // 5. SUBSTITUTO ignora regras: dá uma vara de terça a um (PJ)SUB → 200 (e restaura)
  const promotores = await j(await fetch(b + "/api/promotores"));
  const subs = promotores.find((p) => p.tipo === "SUBSTITUTO" && p.ativo);
  const varaDiaBloqueado = subs && det.designacoes.find((d) => {
    const grupo = det.posicoes.find((p) => p.id === d.posicaoId)?.grupo;
    return grupo === "AUDIENCIAS" && [2, 4].includes(diaSemana(d.data)) && d.promotorId !== alvo.id && d.promotorId !== subs.id && !det.designacoes.some((outra) => outra.data === d.data && outra.promotorId === subs.id);
  });
  exigir(subs && varaDiaBloqueado, "substituto ou audiencia em dia bloqueado nao encontrado");
  const original = varaDiaBloqueado.promotorId;
  r = await patch("/api/designacoes/" + varaDiaBloqueado.id, { promotorId: subs.id });
  exigirStatus(r, 200, "substituto ignorando regra");
  console.log("SUBSTITUTO ignora regra (200):", r.status);
  await patch("/api/designacoes/" + varaDiaBloqueado.id, { promotorId: original });

  // 6. regra com grupos vazios = todos os grupos: alvo não pode NADA em sexta
  await put("/api/regras/" + regra.id, { nome: "TESTE todos grupos exceto sex", tipo: "EXCETO", dias: [5], grupos: [], promotoresIds: [alvo.id] });
  await post("/api/escalas", { ano: 2026, mes: 9 });
  esc = (await j(await fetch(b + "/api/escalas"))).find((e) => e.mes === 9);
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/gerar", { method: "POST" }), 200, "gerar regra de excecao");
  det = await j(await fetch(b + "/api/escalas/" + esc.id));
  const desSex = det.designacoes.filter((d) => d.promotorId === alvo.id && diaSemana(d.data) === 5);
  exigir(desSex.length === 0, `alvo possui ${desSex.length} designacoes na sexta`);
  console.log("alvo sem designações às sextas (esperado 0):", desSex.length);

  // 7. exclusão
  const exclusao = await del("/api/regras/" + regra.id);
  exigirStatus(exclusao, 200, "excluir regra");
  console.log("excluir regra (200):", exclusao.status);
  await post("/api/escalas", { ano: 2026, mes: 9 });
  esc = (await j(await fetch(b + "/api/escalas"))).find((e) => e.mes === 9);
  exigirStatus(await fetch(b + "/api/escalas/" + esc.id + "/gerar", { method: "POST" }), 200, "gerar apos excluir regra");
  det = await j(await fetch(b + "/api/escalas/" + esc.id));
  const aud3 = det.designacoes.filter((d) => d.promotorId === alvo.id && det.posicoes.find((p) => p.id === d.posicaoId).grupo === "AUDIENCIAS");
  const diasAud3 = new Set(aud3.map((d) => diaSemana(d.data)));
  console.log("após excluir, dias com audiências (liberado):", [...diasAud3].join(","), "| total:", aud3.length);
} finally {
  await del("/api/promotores/" + alvo.id);
  await post("/api/escalas", { ano: 2026, mes: 9 });
  console.log("cleanup: TESTE-R removido");
}
console.log("FIM");

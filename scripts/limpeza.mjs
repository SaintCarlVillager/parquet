const b = "http://localhost:3000";
const patch = (p, x) => fetch(b + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });

const promotores = await (await fetch(b + "/api/promotores")).json();
const teste = promotores.filter((p) => p.apelido.startsWith("TESTE"));
console.log("promotores de teste encontrados:", teste.map((p) => p.apelido).join(", ") || "nenhum");
for (const t of teste) {
  for (const d of (await (await fetch(b + "/api/escalas/" + (await (await fetch(b + "/api/escalas")).json()).find((e) => e.mes === 9).id)).json()).designacoes.filter((x) => x.promotorId === t.id)) {
    await patch("/api/designacoes/" + d.id, { promotorId: null });
  }
  await fetch(b + "/api/promotores/" + t.id, { method: "DELETE" });
}

const grade = await (await fetch(b + "/api/grade")).json();
if (grade.gradeItens.length === 0) {
  console.log("GRADE VAZIA no banco — abortando reescrita de pesos para não destruir a grade (PUT com itens vazios apaga tudo). Restaure a grade padrão antes de rodar a limpeza.");
  console.log("total de promotores:", promotores.length - teste.length);
  console.log("FIM");
  process.exit(1);
}
await fetch(b + "/api/grade", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gradeItens: grade.gradeItens,
    grupos: grade.grupos.map((g) => ({ grupo: g.grupo, peso: 1 })),
  }),
});
const depois = await (await fetch(b + "/api/grade")).json();
console.log("pesos agora:", depois.grupos.map((g) => g.grupo + "=" + g.peso).join(", "));
console.log("total de promotores:", promotores.length - teste.length);
console.log("FIM");

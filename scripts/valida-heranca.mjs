const base = "http://localhost:3000";
const j = (r) => r.json();
const post = (p, x) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x) });
const diaSemana = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

const portarias = (await j(await fetch(base + "/api/portarias"))).portarias;
const pt = portarias.find((p) => p.numero === "10621/2026");
if (!pt) { console.log("portaria 10621/2026 não encontrada — nada a testar"); process.exit(0); }
console.log("portaria:", pt.numero, pt.inicio, "a", pt.fim, "| afastado:", pt.promotorAfastado.apelido, "| cobridor:", pt.promotorCobridor?.apelido, "|", pt.modalidade);

const promotores = await j(await fetch(base + "/api/promotores"));
const afastado = promotores.find((p) => p.id === pt.promotorAfastadoId);
const cobridor = promotores.find((p) => p.id === pt.promotorCobridorId);
console.log("varas do afastado:", JSON.stringify(afastado.varas), "| tipo cobridor:", cobridor.tipo);

// regenera setembro
await post("/api/escalas", { ano: 2026, mes: 9 });
const esc = (await j(await fetch(base + "/api/escalas"))).find((e) => e.mes === 9);
const det = await j(await fetch(base + "/api/escalas/" + esc.id));
const posById = new Map(det.posicoes.map((p) => [p.id, p]));

const noPeriodo = (d) => d.data >= pt.inicio && d.data <= pt.fim;
const desAfastado = det.designacoes.filter((d) => d.promotorId === afastado.id && d.posicao.codigo !== "C" && noPeriodo(d));
console.log("designações do afastado no período (esperado 0):", desAfastado.length);

const herdas = det.designacoes.filter((d) => d.promotorId === cobridor.id && d.posicao.codigo !== "C" && noPeriodo(d));
console.log("designações do cobridor no período (herdadas):", herdas.length);
if (herdas.length > 0) {
  const varasOk = herdas.every((d) => afastado.varas.length === 0 || afastado.varas.includes(Number(/^(\d)'?$/.exec(posById.get(d.posicaoId).codigo)[1])));
  const diasOk = herdas.every((d) => {
    // regras aplicáveis = as do AFASTADO (cargo coberto)
    const ds = diaSemana(d.data);
    let impede = false;
    for (const r of (afastado.regras ?? [])) {
      if (r.gruposCsv && !r.gruposCsv.split(",").includes(posById.get(d.posicaoId).grupo)) continue;
      const dias = r.diasCsv.split(",").map(Number);
      if (r.tipo === "EXCETO") { if (dias.includes(ds)) impede = true; }
      else if (!dias.includes(ds)) impede = true;
    }
    return !impede;
  });
  console.log("todas nas varas do afastado (esperado true):", varasOk);
  console.log("todas em dias permitidos pelas REGRAS DO AFASTADO (esperado true):", diasOk);
  const porDia = new Map();
  for (const d of herdas) porDia.set(d.data, (porDia.get(d.data) ?? 0) + 1);
  console.log("máx. 1 por dia (esperado true):", [...porDia.values()].every((n) => n === 1));
  console.log("exemplo:", herdas.slice(0, 4).map((d) => `${d.data} ${posById.get(d.posicaoId).codigo}`).join(", "));
}

// fora do período o cobridor (REGIONAL) continua sem designações automáticas
const foraPeriodo = det.designacoes.filter((d) => d.promotorId === cobridor.id && d.posicao.codigo !== "C" && !noPeriodo(d));
console.log("designações do cobridor fora do período (esperado 0, REGIONAL não concorre):", foraPeriodo.length);
console.log("FIM");

import { db } from "@/lib/db";
import { inserirDesignacoes } from "@/lib/designacoes";
import { atualizarDesignacoes } from "@/lib/escritasAtomicas";
import {
  gerarEscala,
  estaDisponivel,
  atuaEm,
  regraImpede,
  type PromotorInput,
  type RegraInput,
  type VagaInput,
} from "@/lib/gerador";
import { diasDoMes, diaSemana } from "@/lib/datas";
import { cargaAnterior } from "@/lib/carga";

export async function gerarEscalaMes(ano: number, mes: number) {
  // Consultas sequenciais: consultas em lote (Promise.all) não são suportadas pelo driver HTTP do Neon.
  const promotoresDb = await db.promotor.findMany({
    include: {
      bloqueios: true,
      varas: true,
      regras: { include: { regra: true } },
      portariasAfastado: true,
      portariasCobridor: true,
    },
  });
  const posicoes = await db.posicao.findMany({ orderBy: { ordem: "asc" } });
  const gradeItens = await db.gradeItem.findMany();
  const feriados = await db.feriado.findMany();
  const excecoes = await db.gradeExcecao.findMany();
  const gruposDb = await db.grupoCarga.findMany();
  const cargosDb = await db.cargoAdministrativo.findMany();
  const pesos = Object.fromEntries(gruposDb.map((g) => [g.grupo, g.peso]));
  const saldoAnterior = await cargaAnterior(ano, mes, promotoresDb, pesos);
  const secretarioId = cargosDb.find((c) => c.cargo === "SECRETARIO")?.promotorId ?? null;
  const subSecretarioId = cargosDb.find((c) => c.cargo === "SUBSECRETARIO")?.promotorId ?? null;
  const periodosSecretarioCoberto = secretarioId
    ? promotoresDb
        .find((p) => p.id === secretarioId)!
        .portariasAfastado.map((pt) => ({ inicio: pt.inicio, fim: pt.fim }))
    : [];

  const feriadoMap = new Map(feriados.map((f) => [f.data, f.nome]));
  const gradeMap = new Map<number, number[]>();
  for (const g of gradeItens) {
    if (!gradeMap.has(g.diaSemana)) gradeMap.set(g.diaSemana, []);
    gradeMap.get(g.diaSemana)!.push(g.posicaoId);
  }
  const excecaoMap = new Map<string, { posicaoId: number; ativa: boolean }[]>();
  for (const e of excecoes) {
    const key = e.data;
    if (!excecaoMap.has(key)) excecaoMap.set(key, []);
    excecaoMap.get(key)!.push({ posicaoId: e.posicaoId, ativa: e.ativa });
  }

  const varasPorId = new Map(promotoresDb.map((p) => [p.id, p.varas.map((v) => v.vara)]));
  const atuacaoPorId = new Map(promotoresDb.map((p) => [p.id, p.atuacao]));
  const auxiliarPorId = new Map(promotoresDb.map((p) => [p.id, p.tipo === "AUXILIAR"]));
  const regrasPorId = new Map<number, RegraInput[]>(
    promotoresDb.map((p) => [
      p.id,
      p.regras.map((pr) => ({ tipo: pr.regra.tipo, diasCsv: pr.regra.diasCsv, gruposCsv: pr.regra.gruposCsv })),
    ])
  );
  const promotoresInput: PromotorInput[] = promotoresDb.map((p) => ({
    id: p.id,
    apelido: p.apelido,
    tipo: p.tipo,
    atuacao: p.atuacao,
    varas: p.varas.map((v) => v.vara),
    ativo: p.ativo,
    bloqueios: p.bloqueios.map((b) => ({ posicaoId: b.posicaoId, data: b.data })),
    regras: regrasPorId.get(p.id) ?? [],
    portarias: p.portariasAfastado.map((pt) => ({ inicio: pt.inicio, fim: pt.fim })),
    coberturas: p.portariasCobridor.map((pt) => ({
      inicio: pt.inicio,
      fim: pt.fim,
      varas: varasPorId.get(pt.promotorAfastadoId) ?? [],
      regras: regrasPorId.get(pt.promotorAfastadoId) ?? [],
      afastadoId: pt.promotorAfastadoId,
      atuaAfastado: atuacaoPorId.get(pt.promotorAfastadoId) ?? "TODAS",
      modalidade: pt.modalidade,
      afastadoAuxiliar: auxiliarPorId.get(pt.promotorAfastadoId) ?? false,
    })),
    cargo: p.id === secretarioId ? "SECRETARIO" : p.id === subSecretarioId ? "SUBSECRETARIO" : null,
    secretarioCoberto: p.id === subSecretarioId ? periodosSecretarioCoberto : [],
    generico: p.generico,
  }));

  const posicoesById = new Map(posicoes.map((p) => [p.id, p]));
  const dias = diasDoMes(ano, mes);
  const vagas: VagaInput[] = [];

  for (const data of dias) {
    const ds = diaSemana(data);
    const feriado = feriadoMap.has(data);
    if (ds === 0 || ds === 6 || feriado) continue;
    const base = new Set(gradeMap.get(ds) ?? []);
    for (const e of excecaoMap.get(data) ?? []) {
      if (e.ativa) base.add(e.posicaoId);
      else base.delete(e.posicaoId);
    }
    for (const posicaoId of base) {
      const pos = posicoesById.get(posicaoId)!;
      if (pos.codigo === "C") continue;
      vagas.push({
        data,
        posicaoId,
        codigo: pos.codigo,
        grupo: pos.grupo,
        peso: pesos[pos.grupo] ?? 1,
        ordem: pos.ordem,
      });
    }
  }

  // Herança de cobertura: as audiências das varas do afastado, nos dias em que ele
  // as atenderia (regras dele), são pré-alocadas ao cobridor — que age como o cargo coberto.
  const inputPorId = new Map(promotoresInput.map((p) => [p.id, p]));
  const cobridorNoDia = new Set<string>();
  for (const pt of promotoresDb.flatMap((p) => p.portariasCobridor)) {
    const cobridor = inputPorId.get(pt.promotorCobridorId!);
    const afastado = inputPorId.get(pt.promotorAfastadoId);
    if (!cobridor || !afastado || !cobridor.ativo || !afastado.ativo) continue;
    const varasAfastado = varasPorId.get(pt.promotorAfastadoId) ?? [];
    if (varasAfastado.length === 0) continue;
    for (const v of vagas) {
      if (v.prePromotorId || v.grupo !== "AUDIENCIAS") continue;
      if (v.data < pt.inicio || v.data > pt.fim) continue;
      const m = /^(\d)('?)$/.exec(v.codigo);
      if (!m || !varasAfastado.includes(Number(m[1]))) continue;
      // A cobertura cobre apenas o cargo do afastado: titular (N) ou auxiliar (N').
      if ((m[2] === "'") !== (auxiliarPorId.get(pt.promotorAfastadoId) ?? false)) continue;
      if (!atuaEm(afastado, v.codigo)) continue;
      if (regraImpede(afastado.regras, v.grupo, diaSemana(v.data))) continue;
      if (cobridor.portarias.some((x) => x.inicio <= v.data && v.data <= x.fim)) continue;
      if (
        cobridor.bloqueios.some(
          (b) => (b.posicaoId === null || b.posicaoId === v.posicaoId) && (b.data === null || b.data === v.data)
        )
      )
        continue;
      const key = `${v.data}|${cobridor.id}`;
      if (cobridorNoDia.has(key)) continue;
      v.prePromotorId = cobridor.id;
      cobridorNoDia.add(key);
    }
  }

  // PJS (substituto garantido pelo setor de designações) assume uma das varas
  // auxiliares do dia, quando houver, desafogando os PJs titulares.
  // PJE é promotor externo (genérico), não é reserva da auxiliar.
  const pjs = promotoresInput.find((p) => p.generico && p.ativo && p.apelido === "PJS");
  if (pjs) {
    const auxPorDia = new Map<string, VagaInput[]>();
    for (const v of vagas) {
      if (!/^\d'$/.test(v.codigo)) continue;
      const lista = auxPorDia.get(v.data) ?? [];
      lista.push(v);
      auxPorDia.set(v.data, lista);
    }
    for (const [, auxs] of auxPorDia) {
      auxs.sort((a, b) => a.ordem - b.ordem);
      const livre = auxs.find((v) => !v.prePromotorId);
      if (!livre) continue;
      if (estaDisponivel(pjs, livre.data, livre.codigo, livre.posicaoId, livre.grupo)) {
        livre.prePromotorId = pjs.id;
      }
    }
  }

  const escala = await criarEsqueletoMes(ano, mes);

  const existentes = await db.designacao.findMany({
    where: { escalaId: escala.id },
    select: { id: true, data: true, posicaoId: true, promotorId: true, origem: true },
  });
  const existentePorVaga = new Map(existentes.map((d) => [`${d.data}|${d.posicaoId}`, d]));
  const custodiaPorDiaPromotor = new Set(
    existentes
      .filter((d) => d.promotorId && posicoesById.get(d.posicaoId)?.codigo === "C")
      .map((d) => `${d.promotorId}|${d.data}`)
  );
  for (const vaga of vagas) {
    const existente = existentePorVaga.get(`${vaga.data}|${vaga.posicaoId}`);
    if (!existente?.promotorId) continue;
    const promotor = inputPorId.get(existente.promotorId);
    if (existente.origem === "AUTO" && (custodiaPorDiaPromotor.has(`${existente.promotorId}|${vaga.data}`) || !promotor || !estaDisponivel(promotor, vaga.data, vaga.codigo, vaga.posicaoId, vaga.grupo))) {
      existente.promotorId = null;
      continue;
    }
    vaga.prePromotorId = existente.promotorId;
  }
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = `${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01`;
  const trocas = await db.troca.findMany({
    where: { data: { gte: inicio, lt: fim }, posicaoId: { not: null } },
    select: { data: true, posicaoId: true },
  });
  const vagasComAjuste = new Set(trocas.map((t) => `${t.data}|${t.posicaoId}`));
  const vagasParaGerar = vagas.filter((v) => !vagasComAjuste.has(`${v.data}|${v.posicaoId}`));

  const custodiaLancada = new Map(
    (
      await db.designacao.findMany({
        where: { escalaId: escala.id, promotorId: { not: null }, posicao: { codigo: "C" } },
      })
    ).map((d) => [d.data, d.promotorId])
  );

  const diasCustodiaPorPromotor = new Map<number, string[]>();
  for (const [data, pid] of custodiaLancada) {
    const lista = diasCustodiaPorPromotor.get(pid!) ?? [];
    lista.push(data);
    diasCustodiaPorPromotor.set(pid!, lista);
  }
  const promotoresComCustodia = promotoresInput.map((p) => ({
    ...p,
    diasCustodia: diasCustodiaPorPromotor.get(p.id) ?? [],
  }));

  const resultado = gerarEscala(vagasParaGerar, promotoresComCustodia, pesos, saldoAnterior);
  const atualizacoes: { id: number; promotorId: number | null }[] = [];
  const novas: { escalaId: number; data: string; posicaoId: number; promotorId: number | null; origem: string }[] = [];
  for (const alocacao of resultado.alocacoes) {
    const existente = existentePorVaga.get(`${alocacao.data}|${alocacao.posicaoId}`);
    if (existente) {
      if (existente.promotorId === null) {
        atualizacoes.push({ id: existente.id, promotorId: alocacao.promotorId });
      }
    } else {
      novas.push({ escalaId: escala.id, ...alocacao, origem: "AUTO" });
    }
  }
  await atualizarDesignacoes(atualizacoes, novas);

  return escala;
}

export async function criarEsqueletoMes(ano: number, mes: number) {
  const escala = await db.escala.upsert({
    where: { ano_mes: { ano, mes } },
    update: { status: "RASCUNHO" },
    create: { ano, mes, status: "RASCUNHO" },
  });
  const posicoes = await db.posicao.findMany({ orderBy: { ordem: "asc" } });
  const gradeItens = await db.gradeItem.findMany();
  const feriados = await db.feriado.findMany();
  const excecoes = await db.gradeExcecao.findMany();
  const existentes = await db.designacao.findMany({ where: { escalaId: escala.id }, select: { data: true, posicaoId: true } });
  const existentesPorVaga = new Set(existentes.map((d) => `${d.data}|${d.posicaoId}`));
  const gradePorDia = new Map<number, number[]>();
  for (const item of gradeItens) gradePorDia.set(item.diaSemana, [...(gradePorDia.get(item.diaSemana) ?? []), item.posicaoId]);
  const excecoesPorData = new Map<string, { posicaoId: number; ativa: boolean }[]>();
  for (const excecao of excecoes) excecoesPorData.set(excecao.data, [...(excecoesPorData.get(excecao.data) ?? []), excecao]);
  const feriadoSet = new Set(feriados.map((f) => f.data));
  const posicoesPorId = new Map(posicoes.map((p) => [p.id, p]));
  const posicaoCustodia = posicoes.find((p) => p.codigo === "C");
  const novas: { escalaId: number; data: string; posicaoId: number; promotorId: null; origem: string }[] = [];
  for (const data of diasDoMes(ano, mes)) {
    const ds = diaSemana(data);
    if (ds === 0 || ds === 6 || feriadoSet.has(data)) continue;
    const posicoesDoDia = new Set(gradePorDia.get(ds) ?? []);
    for (const excecao of excecoesPorData.get(data) ?? []) {
      if (excecao.ativa) posicoesDoDia.add(excecao.posicaoId);
      else posicoesDoDia.delete(excecao.posicaoId);
    }
    if (posicaoCustodia) posicoesDoDia.add(posicaoCustodia.id);
    for (const posicaoId of posicoesDoDia) {
      if (!posicoesPorId.has(posicaoId) || existentesPorVaga.has(`${data}|${posicaoId}`)) continue;
      novas.push({ escalaId: escala.id, data, posicaoId, promotorId: null, origem: "MANUAL" });
    }
  }
  await inserirDesignacoes(novas);
  return escala;
}

export { estaDisponivel };

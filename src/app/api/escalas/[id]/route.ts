import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, TODOS, exigir } from "@/lib/auth";
import { codigoPrisma, erroInterno, withApiError } from "@/lib/errosApi";
import { inteiroPositivo, lerObjeto } from "@/lib/validacao";
import { aplicarTrocas } from "@/lib/trocas";
import { cargaAnterior } from "@/lib/carga";

const TRANSICOES: Record<string, string[]> = {
  RASCUNHO: ["PRONTA"],
  PRONTA: ["APROVADA", "RASCUNHO"],
  APROVADA: ["PUBLICADA", "RASCUNHO"],
  PUBLICADA: ["RASCUNHO"],
};

export const dynamic = "force-dynamic";

async function getHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, TODOS);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return NextResponse.json({ erro: "Escala invalida" }, { status: 400 });
  const escala = await db.escala.findUnique({
    where: { id: escalaId },
    include: {
      designacoes: {
        include: { posicao: true, promotor: { select: { id: true, apelido: true } } },
      },
    },
  });
  if (!escala) return NextResponse.json({ erro: "Escala não encontrada" }, { status: 404 });

  const { designacoes, ...escalaBase } = escala;
  const trocas = await db.troca.findMany({ where: { data: { gte: `${escala.ano}-${String(escala.mes).padStart(2, "0")}-01`, lt: `${escala.mes === 12 ? escala.ano + 1 : escala.ano}-${String(escala.mes === 12 ? 1 : escala.mes + 1).padStart(2, "0")}-01` } } });
  const designacoesMascaradas = aplicarTrocas(designacoes, trocas);

  const promotores = await db.promotor.findMany({
    orderBy: { apelido: "asc" },
    include: {
      bloqueios: true,
      varas: true,
      regras: { include: { regra: true } },
      portariasAfastado: true,
      portariasCobridor: true,
    },
  });
  const posicoes = await db.posicao.findMany({ orderBy: { ordem: "asc" } });
  const feriados = await db.feriado.findMany();
  const gradeItens = await db.gradeItem.findMany();
  const excecoes = await db.gradeExcecao.findMany();
  const grupos = await db.grupoCarga.findMany({ orderBy: { grupo: "asc" } });
  const saldoAnteriorMap = await cargaAnterior(
    escala.ano,
    escala.mes,
    promotores,
    Object.fromEntries(grupos.map((g) => [g.grupo, g.peso]))
  );

  const varasPorId = new Map(promotores.map((p) => [p.id, p.varas.map((v) => v.vara)]));
  const atuacaoPorId = new Map(promotores.map((p) => [p.id, p.atuacao]));
  const auxiliarPorId = new Map(promotores.map((p) => [p.id, p.tipo === "AUXILIAR"]));
  const cargos = await db.cargoAdministrativo.findMany();
  const cargoPorId = new Map<number, string>();
  for (const c of cargos) if (c.promotorId) cargoPorId.set(c.promotorId, c.cargo);
  const regrasPorId = new Map(
    promotores.map((p) => [
      p.id,
      p.regras.map((pr) => ({ tipo: pr.regra.tipo, diasCsv: pr.regra.diasCsv, gruposCsv: pr.regra.gruposCsv })),
    ])
  );
  const promotorPorId = new Map(promotores.map((p) => [p.id, { id: p.id, apelido: p.apelido }]));
  const designacoesFinais = designacoesMascaradas.map((d) => ({
    ...d,
    promotor: d.origem === "TROCA" ? promotorPorId.get(d.promotorId ?? -1) ?? null : d.promotor,
    trocaCom: d.trocaOrigemId ? promotorPorId.get(d.trocaOrigemId)?.apelido ?? null : d.origem === "TROCA" ? "vaga sem candidato" : null,
  }));

  return NextResponse.json({
    escala: escalaBase,
    designacoes: designacoesFinais,
    trocas,
    promotores: promotores.map((p) => ({
      ...p,
      varas: p.varas.map((v) => v.vara),
      regras: regrasPorId.get(p.id) ?? [],
      portarias: p.portariasAfastado.map((pt) => ({ inicio: pt.inicio, fim: pt.fim, numero: pt.numero })),
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
      cargo: cargoPorId.get(p.id) ?? null,
      generico: p.generico,
    })),
    posicoes,
    feriados,
    gradeItens,
    excecoes,
    grupos,
    saldoAnterior: Object.fromEntries(saldoAnteriorMap),
  });
}

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return NextResponse.json({ erro: "Escala invalida" }, { status: 400 });
  try {
    await db.escala.delete({ where: { id: escalaId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Escala não encontrada" }, { status: 404 });
    return erroInterno("escalas.id.DELETE", e);
  }
}

async function patchHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return NextResponse.json({ erro: "Escala invalida" }, { status: 400 });
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Corpo da requisicao invalido" }, { status: 400 });
  const escala = await db.escala.findUnique({ where: { id: escalaId } });
  if (!escala) return NextResponse.json({ erro: "Escala não encontrada" }, { status: 404 });

  if (body.observacao !== undefined) {
    if (typeof body.observacao !== "string" || body.observacao.length > 500) {
      return NextResponse.json({ erro: "Observação deve ser texto de até 500 caracteres" }, { status: 400 });
    }
    const atualizada = await db.escala.update({
      where: { id: escala.id },
      data: { observacao: body.observacao },
    });
    return NextResponse.json(atualizada);
  }

  const novoStatus = body.status as string;
  if (!novoStatus || !(TRANSICOES[escala.status] ?? []).includes(novoStatus)) {
    return NextResponse.json(
      { erro: `Transição inválida de ${escala.status} para ${novoStatus ?? "?"}` },
      { status: 400 }
    );
  }

  if (novoStatus === "PRONTA") {
    const vagas = await db.designacao.findMany({
      where: { escalaId: escala.id, promotorId: null, posicao: { codigo: { not: "C" } } },
      select: { data: true, posicaoId: true },
    });
    const ajustes = await db.troca.findMany({
      where: {
        data: {
          gte: `${escala.ano}-${String(escala.mes).padStart(2, "0")}-01`,
          lt: `${escala.mes === 12 ? escala.ano + 1 : escala.ano}-${String(escala.mes === 12 ? 1 : escala.mes + 1).padStart(2, "0")}-01`,
        },
        promotorOrigemId: null,
        posicaoId: { not: null },
      },
      select: { data: true, posicaoId: true },
    });
    const ajustadas = new Set(ajustes.map((a) => `${a.data}|${a.posicaoId}`));
    const vagasEmBranco = vagas.filter((v) => !ajustadas.has(`${v.data}|${v.posicaoId}`)).length;
    if (vagasEmBranco > 0) {
      return NextResponse.json(
        { erro: `Existem ${vagasEmBranco} vaga(s) em branco (fora Custódia, que é manual). Preencha antes de marcar como PRONTA.` },
        { status: 409 }
      );
    }
  }

  const atualizada = await db.escala.update({ where: { id: escala.id }, data: { status: novoStatus } });
  return NextResponse.json(atualizada);
}

export const GET = withApiError("escalas.id.GET", getHandler);
export const DELETE = withApiError("escalas.id.DELETE", deleteHandler);
export const PATCH = withApiError("escalas.id.PATCH", patchHandler);

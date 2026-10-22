import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth";
import { substituirVinculosRegra } from "@/lib/escritasAtomicas";
import { inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";
import { codigoPrisma, withApiError } from "@/lib/errosApi";

const include = {
  promotores: {
    include: { promotor: { select: { id: true, apelido: true, nome: true, ativo: true } } },
  },
};

async function putHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const body = await lerObjeto(req);
  const regraId = inteiroPositivo(id);
  if (!body || !regraId) return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
  const existente = await db.regra.findUnique({ where: { id: regraId } });
  if (!existente) return NextResponse.json({ erro: "Regra não encontrada" }, { status: 404 });

  const nome = texto(body.nome, 120, true);
  if (!nome) return NextResponse.json({ erro: "Informe o nome da regra" }, { status: 400 });
  const diasInformados = Array.isArray(body.dias) ? body.dias.map((dia) => Number(dia)) : [];
  const dias: number[] = Array.from(new Set(diasInformados)).sort((a, b) => a - b);
  if (dias.length === 0 || dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    return NextResponse.json({ erro: "Dias da semana invalidos" }, { status: 400 });
  }
  const grupos = Array.isArray(body.grupos) ? body.grupos.map((grupo) => texto(grupo, 80, true)) : [];
  if (grupos.some((grupo) => !grupo)) return NextResponse.json({ erro: "Grupo invalido" }, { status: 400 });
  const promotoresBrutos = body.promotoresIds === undefined
    ? []
    : Array.isArray(body.promotoresIds)
      ? body.promotoresIds.map((pid) => inteiroPositivo(pid))
      : null;
  if (!promotoresBrutos || promotoresBrutos.some((pid) => pid === null)) return NextResponse.json({ erro: "Promotor invalido" }, { status: 400 });
  const promotoresIds: number[] = Array.from(new Set(promotoresBrutos.filter((pid): pid is number => pid !== null)));

  await db.regra.update({
    where: { id: regraId },
    data: {
      nome,
      tipo: body.tipo === "EXCETO" ? "EXCETO" : "SOMENTE",
      diasCsv: dias.join(","),
      gruposCsv: [...new Set(grupos)].join(","),
    },
  });
  await substituirVinculosRegra(regraId, promotoresIds);
  const regra = await db.regra.findUnique({ where: { id: regraId }, include });
  return NextResponse.json(regra);
}

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const regraId = inteiroPositivo(id);
  if (!regraId) return NextResponse.json({ erro: "Regra invalida" }, { status: 400 });
  try {
    await db.regra.delete({ where: { id: regraId } });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Regra não encontrada" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const PUT = withApiError("regras.id.PUT", putHandler);
export const DELETE = withApiError("regras.id.DELETE", deleteHandler);

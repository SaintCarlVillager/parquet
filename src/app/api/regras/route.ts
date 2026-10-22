import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TODOS, exigir } from "@/lib/auth";
import { substituirVinculosRegra } from "@/lib/escritasAtomicas";
import { inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

const include = {
  promotores: {
    include: { promotor: { select: { id: true, apelido: true, nome: true, ativo: true } } },
  },
};

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const regras = await db.regra.findMany({ include, orderBy: { nome: "asc" } });
  return NextResponse.json(regras);
}

async function postHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const nome = texto(body?.nome, 120, true);
  if (!body || !nome) return NextResponse.json({ erro: "Informe o nome da regra" }, { status: 400 });
  const diasInformados = Array.isArray(body?.dias) ? body.dias.map((dia) => Number(dia)) : [];
  const dias: number[] = Array.from(new Set(diasInformados)).sort((a, b) => a - b);
  if (dias.length === 0 || dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    return NextResponse.json({ erro: "Dias da semana invalidos" }, { status: 400 });
  }
  const grupos = Array.isArray(body?.grupos) ? body.grupos.map((grupo) => texto(grupo, 80, true)) : [];
  if (grupos.some((grupo) => !grupo)) return NextResponse.json({ erro: "Grupo invalido" }, { status: 400 });
  const promotoresBrutos = body.promotoresIds === undefined
    ? []
    : Array.isArray(body.promotoresIds)
      ? body.promotoresIds.map((id) => inteiroPositivo(id))
      : null;
  if (!promotoresBrutos || promotoresBrutos.some((id) => id === null)) return NextResponse.json({ erro: "Promotor invalido" }, { status: 400 });
  const promotoresIds: number[] = Array.from(new Set(promotoresBrutos.filter((id): id is number => id !== null)));
  const criada = await db.regra.create({
    data: {
      nome,
      tipo: body.tipo === "EXCETO" ? "EXCETO" : "SOMENTE",
      diasCsv: dias.join(","),
      gruposCsv: [...new Set(grupos)].join(","),
    },
  });
  await substituirVinculosRegra(criada.id, promotoresIds);
  const regra = await db.regra.findUnique({ where: { id: criada.id }, include });
  return NextResponse.json(regra, { status: 201 });
}

export const GET = withApiError("regras.GET", getHandler);
export const POST = withApiError("regras.POST", postHandler);

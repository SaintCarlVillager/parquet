import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { criarEsqueletoMes } from "@/lib/escalaService";
import { EDICAO, TODOS, exigir } from "@/lib/auth";
import { erroInterno, withApiError } from "@/lib/errosApi";
import { inteiroPositivo, lerObjeto } from "@/lib/validacao";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const escalas = await db.escala.findMany({
    orderBy: [{ ano: "desc" }, { mes: "desc" }],
    include: { _count: { select: { designacoes: true } } },
  });
  return NextResponse.json(escalas);
}

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const ano = inteiroPositivo(body?.ano);
  const mes = inteiroPositivo(body?.mes);
  if (!ano || !mes || ano < 2000 || ano > 2200 || mes > 12) {
    return NextResponse.json({ erro: "Mês/ano inválidos" }, { status: 400 });
  }
  try {
    const escala = await criarEsqueletoMes(ano, mes);
    return NextResponse.json(escala, { status: 201 });
  } catch (e) {
    return erroInterno("escalas.POST", e);
  }
}

export const GET = withApiError("escalas.GET", getHandler);
export const POST = withApiError("escalas.POST", postHandler);

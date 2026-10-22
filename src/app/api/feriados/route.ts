import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LEITURA, exigir } from "@/lib/auth";
import { erroInterno, withApiError } from "@/lib/errosApi";
import { dataISO, inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, LEITURA);
  if ("erro" in g) return g.erro;
  const ano = new URL(req.url).searchParams.get("ano");
  const feriados = await db.feriado.findMany({
    where: ano ? { data: { startsWith: `${ano}-` } } : undefined,
    orderBy: { data: "asc" },
  });
  return NextResponse.json(feriados);
}

async function postHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const data = dataISO(body?.data);
  const ano = inteiroPositivo(body?.ano);
  const nome = texto(body?.nome, 200, true);
  if (!body || !data || !ano || !nome) {
    return NextResponse.json({ erro: "Ano, data e nome são obrigatórios" }, { status: 400 });
  }
  if (data.slice(0, 4) !== String(ano)) {
    return NextResponse.json({ erro: "A data deve pertencer ao ano selecionado" }, { status: 400 });
  }
  try {
    const feriado = await db.feriado.upsert({
      where: { data },
      update: { nome },
      create: { data, nome },
    });
    return NextResponse.json(feriado, { status: 201 });
  } catch (e) {
    return erroInterno("feriados.POST", e);
  }
}

export const GET = withApiError("feriados.GET", getHandler);
export const POST = withApiError("feriados.POST", postHandler);

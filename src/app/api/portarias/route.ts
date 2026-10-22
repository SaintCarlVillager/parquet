import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validarPortaria } from "@/lib/portarias";
import { EDICAO, TODOS, exigir } from "@/lib/auth";
import { lerObjeto, textoOpcional } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const portarias = await db.portaria.findMany({
    orderBy: [{ inicio: "desc" }, { id: "desc" }],
    include: {
      promotorAfastado: { select: { id: true, apelido: true, nome: true } },
      promotorCobridor: { select: { id: true, apelido: true, nome: true } },
    },
  });
  const promotores = await db.promotor.findMany({
    where: { ativo: true },
    orderBy: { apelido: "asc" },
    select: { id: true, apelido: true, nome: true },
  });
  return NextResponse.json({ portarias, promotores });
}

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
  const v = validarPortaria(body);
  if (v.erro || !v.dados) return NextResponse.json({ erro: v.erro }, { status: 400 });
  const numero = textoOpcional(body.numero, 200);
  const observacao = textoOpcional(body.observacao, 500);
  if ((numero === null && body.numero !== undefined && body.numero !== null) || (observacao === null && body.observacao !== undefined && body.observacao !== null)) {
    return NextResponse.json({ erro: "Numero ou observacao invalidos" }, { status: 400 });
  }
  // Modo HTTP do Neon: write com include vira transação (não suportada) — write simples + leitura.
  const criada = await db.portaria.create({
    data: {
      ...v.dados,
      numero,
      observacao,
    },
  });
  const portaria = await db.portaria.findUnique({ where: { id: criada.id }, include: {
    promotorAfastado: { select: { id: true, apelido: true, nome: true } },
    promotorCobridor: { select: { id: true, apelido: true, nome: true } },
  } });
  return NextResponse.json(portaria, { status: 201 });
}

export const GET = withApiError("portarias.GET", getHandler);
export const POST = withApiError("portarias.POST", postHandler);

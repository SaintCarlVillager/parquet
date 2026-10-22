import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validarPortaria } from "@/lib/portarias";
import { EDICAO, exigir } from "@/lib/auth";
import { inteiroPositivo } from "@/lib/validacao";
import { lerObjeto, textoOpcional } from "@/lib/validacao";
import { codigoPrisma, withApiError } from "@/lib/errosApi";

const include = {
  promotorAfastado: { select: { id: true, apelido: true, nome: true } },
  promotorCobridor: { select: { id: true, apelido: true, nome: true } },
};

async function putHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
  const v = validarPortaria(body);
  if (v.erro || !v.dados) return NextResponse.json({ erro: v.erro }, { status: 400 });
  const numero = textoOpcional(body.numero, 200);
  const observacao = textoOpcional(body.observacao, 500);
  if ((numero === null && body.numero !== undefined && body.numero !== null) || (observacao === null && body.observacao !== undefined && body.observacao !== null)) {
    return NextResponse.json({ erro: "Numero ou observacao invalidos" }, { status: 400 });
  }
  const portariaId = inteiroPositivo(id);
  if (!portariaId) return NextResponse.json({ erro: "Portaria invalida" }, { status: 400 });
  const existente = await db.portaria.findUnique({ where: { id: portariaId } });
  if (!existente) return NextResponse.json({ erro: "Portaria não encontrada" }, { status: 404 });
  // Modo HTTP do Neon: write com include vira transação (não suportada) — write simples + leitura.
  await db.portaria.update({
    where: { id: existente.id },
    data: {
      ...v.dados,
      numero,
      observacao,
    },
  });
  const portaria = await db.portaria.findUnique({ where: { id: existente.id }, include });
  return NextResponse.json(portaria);
}

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const portariaId = inteiroPositivo(id);
  if (!portariaId) return NextResponse.json({ erro: "Portaria invalida" }, { status: 400 });
  try {
    await db.portaria.delete({ where: { id: portariaId } });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Portaria não encontrada" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const PUT = withApiError("portarias.id.PUT", putHandler);
export const DELETE = withApiError("portarias.id.DELETE", deleteHandler);

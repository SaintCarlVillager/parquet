import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { inteiroPositivo } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const excecaoId = inteiroPositivo(id);
  if (!excecaoId) return NextResponse.json({ erro: "Excecao invalida" }, { status: 400 });
  const removidas = await db.gradeExcecao.deleteMany({ where: { id: excecaoId } });
  if (removidas.count === 0) return NextResponse.json({ erro: "Excecao não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const DELETE = withApiError("excecoes.id.DELETE", deleteHandler);

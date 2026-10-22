import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { inteiroPositivo } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

async function postHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return NextResponse.json({ erro: "Escala invalida" }, { status: 400 });
  const escala = await db.escala.findUnique({ where: { id: escalaId } });
  if (!escala) return NextResponse.json({ erro: "Escala não encontrada" }, { status: 404 });
  if (escala.status === "PUBLICADA") {
    return NextResponse.json({ erro: "Escala publicada: reabra-a antes de limpar" }, { status: 409 });
  }

  const designacoes = await db.designacao.findMany({
    where: { escalaId: escala.id },
    select: { id: true, posicao: { select: { codigo: true } } },
  });
  let limpas = 0;
  for (const designacao of designacoes) {
    if (designacao.posicao.codigo === "C") continue;
    await db.designacao.update({
      where: { id: designacao.id },
      data: { promotorId: null, origem: "MANUAL", travada: false },
    });
    limpas++;
  }

  if (escala.status !== "RASCUNHO") {
    await db.escala.update({ where: { id: escala.id }, data: { status: "RASCUNHO" } });
  }
  return NextResponse.json({
    ok: true,
    limpas,
  });
}

export const POST = withApiError("escalas.id.reset.POST", postHandler);

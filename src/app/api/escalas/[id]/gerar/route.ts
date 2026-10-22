import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gerarEscalaMes } from "@/lib/escalaService";
import { EDICAO, exigir } from "@/lib/auth";
import { erroInterno, withApiError } from "@/lib/errosApi";
import { inteiroPositivo } from "@/lib/validacao";

async function postHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return NextResponse.json({ erro: "Escala invalida" }, { status: 400 });
  const escala = await db.escala.findUnique({ where: { id: escalaId } });
  if (!escala) return NextResponse.json({ erro: "Escala não encontrada" }, { status: 404 });
  if (escala.status === "PUBLICADA") {
    return NextResponse.json({ erro: "Escala publicada: reabra-a antes de gerar designações" }, { status: 409 });
  }
  try {
    const atualizada = await gerarEscalaMes(escala.ano, escala.mes);
    return NextResponse.json(atualizada);
  } catch (e) {
    return erroInterno("escalas.id.gerar.POST", e);
  }
}

export const POST = withApiError("escalas.id.gerar.POST", postHandler);

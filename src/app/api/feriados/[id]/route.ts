import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth";
import { codigoPrisma, erroInterno, withApiError } from "@/lib/errosApi";
import { inteiroPositivo } from "@/lib/validacao";

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const feriadoId = inteiroPositivo(id);
  if (!feriadoId) return NextResponse.json({ erro: "Feriado invalido" }, { status: 400 });
  try {
    await db.feriado.delete({ where: { id: feriadoId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Feriado não encontrado" }, { status: 404 });
    return erroInterno("feriados.id.DELETE", e);
  }
}

export const DELETE = withApiError("feriados.id.DELETE", deleteHandler);

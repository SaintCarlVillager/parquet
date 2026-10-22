import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { withApiError } from "@/lib/errosApi";

export const dynamic = "force-dynamic";

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const escalas = await db.escala.findMany({ select: { id: true } });
  if (escalas.length > 0) {
    await db.escala.deleteMany({ where: { id: { in: escalas.map((e) => e.id) } } });
  }
  return NextResponse.json({ ok: true, apagadas: escalas.length });
}

export const POST = withApiError("configuracoes.reset.POST", postHandler);

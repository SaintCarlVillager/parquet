import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { withApiError } from "@/lib/errosApi";

export const dynamic = "force-dynamic";

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const { count } = await db.escala.deleteMany();
  return NextResponse.json({ ok: true, apagadas: count });
}

export const POST = withApiError("configuracoes.reset.POST", postHandler);

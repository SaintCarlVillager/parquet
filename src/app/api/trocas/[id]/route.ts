import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO_TROCAS, exigir } from "@/lib/auth";
import { inteiroPositivo } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

async function deleteHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, EDICAO_TROCAS);
  if ("erro" in g) return g.erro;
  const trocaId = inteiroPositivo((await params).id);
  if (!trocaId) return NextResponse.json({ erro: "Troca invalida" }, { status: 400 });
  const troca = await db.troca.findUnique({ where: { id: trocaId } });
  if (!troca) return NextResponse.json({ erro: "Troca não encontrada" }, { status: 404 });
  if (g.papel === "OFICIAL") {
    if (troca.promotorOrigemId === null) return NextResponse.json({ erro: "Ajustes de vagas só podem ser alterados pela Chefia." }, { status: 403 });
    const contas = await db.usuarioPapel.findMany({ where: { papel: "PROMOTOR", oficialEmail: g.email.toLowerCase() }, select: { email: true } });
    const emails = new Set(contas.map((u) => u.email.toLowerCase()));
    const locais = new Set(contas.map((u) => u.email.toLowerCase().split("@")[0]));
    const promotores = await db.promotor.findMany({ select: { id: true, email: true, apelido: true } });
    const permitidos = promotores.filter((p) => emails.has((p.email ?? "").toLowerCase()) || locais.has(p.apelido.toLowerCase())).map((p) => p.id);
    if (!permitidos.includes(troca.promotorOrigemId)) {
      return NextResponse.json({ erro: "O Oficial só pode alterar trocas relativas ao seu promotor." }, { status: 403 });
    }
  }
  await db.troca.delete({ where: { id: troca.id } });
  return NextResponse.json({ ok: true });
}

export const DELETE = withApiError("trocas.id.DELETE", deleteHandler);

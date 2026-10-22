import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TODOS, exigir } from "@/lib/auth";
import { substituirVaras } from "@/lib/escritasAtomicas";
import { lerObjeto, texto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const promotores = await db.promotor.findMany({
    orderBy: { apelido: "asc" },
    include: { varas: true },
  });
  return NextResponse.json(promotores.map((p) => ({ ...p, varas: p.varas.map((v) => v.vara) })));
}

async function postHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const nome = texto(body?.nome, 200, true);
  const apelido = texto(body?.apelido, 80, true);
  const observacoes = body?.observacoes === undefined || body.observacoes === null ? "" : texto(body.observacoes, 2000);
  if (!body || !nome || !apelido || observacoes === null || (body.observacoes !== undefined && body.observacoes !== null && typeof body.observacoes !== "string")) {
    return NextResponse.json({ erro: "Nome, apelido ou observações inválidos" }, { status: 400 });
  }
  const varas: number[] = Array.isArray(body.varas)
    ? body.varas.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 6)
    : [];
  const existente = await db.promotor.findUnique({ where: { apelido } });
  if (existente) return NextResponse.json({ erro: "Apelido já existe" }, { status: 409 });

  // Modo HTTP do Neon não suporta nested create relacional (vira transação): operações sequenciais.
  const promotor = await db.promotor.create({
    data: {
      nome,
      apelido,
      email: typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null,
      tipo: typeof body.tipo === "string" && body.tipo.trim() ? body.tipo.trim() : "TITULAR",
      atuacao: typeof body.atuacao === "string" && body.atuacao.trim() ? body.atuacao.trim() : "TODAS",
      ativo: typeof body.ativo === "boolean" ? body.ativo : true,
      generico: Boolean(body.generico),
      observacoes: observacoes || null,
    },
  });
  await substituirVaras(promotor.id, [...new Set(varas)]);
  return NextResponse.json({ ...promotor, varas }, { status: 201 });
}

export const GET = withApiError("promotores.GET", getHandler);
export const POST = withApiError("promotores.POST", postHandler);

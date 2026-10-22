import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth";
import { codigoPrisma, erroInterno, withApiError } from "@/lib/errosApi";
import { substituirVaras } from "@/lib/escritasAtomicas";
import { inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";

async function patchHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const promotorId = inteiroPositivo(id);
  const body = await lerObjeto(req);
  if (!promotorId || !body) return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.nome !== undefined) {
    const nome = texto(body.nome, 200, true);
    if (!nome) return NextResponse.json({ erro: "Nome invalido" }, { status: 400 });
    data.nome = nome;
  }
  if (body.apelido !== undefined) {
    const apelido = texto(body.apelido, 80, true);
    if (!apelido) return NextResponse.json({ erro: "Apelido invalido" }, { status: 400 });
    data.apelido = apelido;
  }
  if (body.email !== undefined && body.email !== null && typeof body.email !== "string") {
    return NextResponse.json({ erro: "E-mail invalido" }, { status: 400 });
  }
  if (body.email !== undefined) data.email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.atuacao !== undefined) data.atuacao = body.atuacao;
  if (body.ativo !== undefined) data.ativo = body.ativo;
  if (body.generico !== undefined) data.generico = Boolean(body.generico);
  if (body.observacoes !== undefined) {
    if (body.observacoes !== null && typeof body.observacoes !== "string") {
      return NextResponse.json({ erro: "Observações inválidas" }, { status: 400 });
    }
    const observacoes = body.observacoes === null ? "" : texto(body.observacoes, 2000);
    if (observacoes === null) return NextResponse.json({ erro: "Observações inválidas" }, { status: 400 });
    data.observacoes = observacoes || null;
  }
  try {
    // Modo HTTP do Neon não suporta transações interativas: operações sequenciais.
    await db.promotor.update({ where: { id: promotorId }, data });
    if (body.varas !== undefined) {
       const varas: number[] = Array.isArray(body.varas)
         ? body.varas.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 6)
         : [];
       await substituirVaras(promotorId, [...new Set(varas)]);
    }
    const promotor = await db.promotor.findUnique({ where: { id: promotorId }, include: { varas: true } });
    return NextResponse.json(promotor);
  } catch (e) {
    if (codigoPrisma(e) === "P2002") return NextResponse.json({ erro: "Apelido já existe" }, { status: 409 });
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Promotor não encontrado" }, { status: 404 });
    return erroInterno("promotores.id.PATCH", e);
  }
}

async function deleteHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const promotorId = inteiroPositivo(id);
  if (!promotorId) return NextResponse.json({ erro: "Promotor invalido" }, { status: 400 });
  try {
    await db.promotor.delete({ where: { id: promotorId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (codigoPrisma(e) === "P2003") return NextResponse.json({ erro: "Promotor possui vínculos; desative-o em vez de excluir" }, { status: 400 });
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ erro: "Promotor não encontrado" }, { status: 404 });
    return erroInterno("promotores.id.DELETE", e);
  }
}

export const PATCH = withApiError("promotores.id.PATCH", patchHandler);
export const DELETE = withApiError("promotores.id.DELETE", deleteHandler);

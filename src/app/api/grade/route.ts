import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LEITURA, exigir } from "@/lib/auth";
import { substituirGrade } from "@/lib/escritasAtomicas";
import { withApiError } from "@/lib/errosApi";
import { lerObjeto } from "@/lib/validacao";

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, LEITURA);
  if ("erro" in g) return g.erro;
  const posicoes = await db.posicao.findMany({ orderBy: { ordem: "asc" } });
  const gradeItens = await db.gradeItem.findMany();
  const excecoes = await db.gradeExcecao.findMany({ include: { posicao: true }, orderBy: { data: "asc" } });
  const grupos = await db.grupoCarga.findMany({ orderBy: { grupo: "asc" } });
  return NextResponse.json({ posicoes, gradeItens, excecoes, grupos });
}

async function putHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Corpo da requisicao invalido" }, { status: 400 });
  const grupos: { grupo: string; peso: number }[] = Array.isArray(body.grupos)
    ? body.grupos.map((g: { grupo?: unknown; peso?: unknown }) => ({ grupo: String(g.grupo ?? ""), peso: Number(g.peso) }))
    : [];
  const ativar: { diaSemana: number; posicaoId: number }[] = Array.isArray(body.gradeItens)
    ? body.gradeItens.map((g: { diaSemana?: unknown; posicaoId?: unknown }) => ({
        diaSemana: Number(g.diaSemana),
        posicaoId: Number(g.posicaoId),
      }))
    : [];
  if (grupos.some((g) => !g.grupo || !Number.isFinite(g.peso) || g.peso < 0)) {
    return NextResponse.json({ erro: "Pesos de carga invalidos" }, { status: 400 });
  }
  if (ativar.some((g) => !Number.isInteger(g.diaSemana) || g.diaSemana < 0 || g.diaSemana > 6 || !Number.isInteger(g.posicaoId))) {
    return NextResponse.json({ erro: "Itens da grade invalidos" }, { status: 400 });
  }
  const todos = await db.posicao.findMany();
  const validos = new Set(todos.map((p) => p.id));
  const data = ativar
    .filter((g) => validos.has(Number(g.posicaoId)))
    .filter((g, i, lista) => lista.findIndex((x) => x.diaSemana === g.diaSemana && x.posicaoId === g.posicaoId) === i);
  const gruposDb = await db.grupoCarga.findMany({ select: { grupo: true } });
  const gruposValidos = new Set(gruposDb.map((g) => g.grupo));
  if (grupos.some((g) => !gruposValidos.has(g.grupo))) {
    return NextResponse.json({ erro: "Grupo de carga inexistente" }, { status: 400 });
  }
  await substituirGrade(grupos, data);
  return NextResponse.json({ ok: true });
}

export const GET = withApiError("grade.GET", getHandler);
export const PUT = withApiError("grade.PUT", putHandler);

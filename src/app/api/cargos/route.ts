import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TODOS, exigir } from "@/lib/auth";
import { inteiroPositivo, lerObjeto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

const CARGOS = ["SECRETARIO", "SUBSECRETARIO"];

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const rows = await db.cargoAdministrativo.findMany();
  return NextResponse.json({
    SECRETARIO: rows.find((r) => r.cargo === "SECRETARIO")?.promotorId ?? null,
    SUBSECRETARIO: rows.find((r) => r.cargo === "SUBSECRETARIO")?.promotorId ?? null,
  });
}

async function putHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
  const alvo: Record<string, number | null> = {};
  for (const cargo of CARGOS) {
    const v = body[cargo];
    alvo[cargo] = v === null || v === "" || v === undefined ? null : inteiroPositivo(v);
    if (v !== null && v !== "" && v !== undefined && alvo[cargo] === null) {
      return NextResponse.json({ erro: "Promotor invalido" }, { status: 400 });
    }
  }
  const ids = CARGOS.map((c) => alvo[c]).filter((x): x is number => x !== null);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ erro: "O mesmo promotor não pode ocupar os dois cargos" }, { status: 400 });
  }
  for (const pid of ids) {
    const p = await db.promotor.findUnique({ where: { id: pid } });
    if (!p) return NextResponse.json({ erro: "Promotor não encontrado" }, { status: 404 });
    if (!p.ativo) return NextResponse.json({ erro: `${p.apelido} está inativo` }, { status: 400 });
  }
  for (const cargo of CARGOS) {
    await db.cargoAdministrativo.upsert({
      where: { cargo },
      update: { promotorId: alvo[cargo] },
      create: { cargo, promotorId: alvo[cargo] },
    });
  }
  return NextResponse.json({ SECRETARIO: alvo.SECRETARIO, SUBSECRETARIO: alvo.SUBSECRETARIO });
}

export const GET = withApiError("cargos.GET", getHandler);
export const PUT = withApiError("cargos.PUT", putHandler);

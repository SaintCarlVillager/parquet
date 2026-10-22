import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigir, hashSenha, type Papel } from "@/lib/auth";
import { codigoPrisma, withApiError } from "@/lib/errosApi";
import { SENHA_MAXIMA, SENHA_MINIMA, senhaValida } from "@/lib/validacao";

const PAPEIS: Papel[] = ["CHEFE", "OFICIAL", "PROMOTOR"];

export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const usuarios = await db.usuarioPapel.findMany({ orderBy: { email: "asc" } });
  const oficiais = usuarios.filter((u) => u.papel === "OFICIAL").map((u) => ({ email: u.email, nome: u.nome }));
  return NextResponse.json({ usuarios: usuarios.map(({ senhaHash, ...u }) => ({ ...u, temSenha: !!senhaHash })), oficiais });
}

async function putHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const b = (await req.json().catch(() => null)) as
    | { email?: string; nome?: string | null; papel?: string; senha?: string | null; oficialEmail?: string | null }
    | null;
  if (!b?.email || !PAPEIS.includes(b.papel as Papel)) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }
  const email = b.email?.trim().toLowerCase() ?? "";
  const oficialEmail = b.papel === "PROMOTOR" ? b.oficialEmail?.trim().toLowerCase() || null : null;
  if (oficialEmail && !(await db.usuarioPapel.findFirst({ where: { email: oficialEmail, papel: "OFICIAL" }, select: { email: true } }))) {
    return NextResponse.json({ error: "Oficial vinculado não encontrado" }, { status: 400 });
  }
  const data: { nome: string | null; papel: string; oficialEmail: string | null; senhaHash?: string } = {
    nome: b.nome?.trim() || null,
    papel: b.papel as string,
    oficialEmail,
  };
  if (b.senha !== undefined && b.senha !== null) {
    const senha = senhaValida(b.senha);
    if (!senha) {
      return NextResponse.json(
        { error: `Senha deve ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres` },
        { status: 400 }
      );
    }
    data.senhaHash = hashSenha(senha);
  }
  const u = await db.usuarioPapel.upsert({
    where: { email },
    create: { email, ...data },
    update: { ...data, sessaoVersao: { increment: 1 } },
  });
  return NextResponse.json({ email: u.email, nome: u.nome, papel: u.papel, oficialEmail: u.oficialEmail });
}

async function deleteHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
  if ("erro" in g) return g.erro;
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) return NextResponse.json({ error: "E-mail obrgatorio" }, { status: 400 });
  if (email === g.email) {
    return NextResponse.json({ error: "Nao e possivel remover a propria conta" }, { status: 400 });
  }
  try {
    await db.usuarioPapel.delete({ where: { email } });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const GET = withApiError("usuarios.GET", getHandler);
export const PUT = withApiError("usuarios.PUT", putHandler);
export const DELETE = withApiError("usuarios.DELETE", deleteHandler);

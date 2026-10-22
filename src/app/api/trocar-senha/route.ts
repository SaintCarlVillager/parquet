import { NextResponse } from "next/server";
import { withApiError } from "@/lib/errosApi";
import { db } from "@/lib/db";
import { conferirSenha, criarToken, exigir, hashSenha, NOME_COOKIE, OPCOES_COOKIE } from "@/lib/auth";
import { lerObjeto, SENHA_MAXIMA, SENHA_MINIMA, senhaValida } from "@/lib/validacao";

async function postHandler(req: Request) {
  const g = await exigir(req, ["CHEFE", "OFICIAL", "PROMOTOR"]);
  if ("erro" in g) return g.erro;
  const b = await lerObjeto(req);
  const atual = typeof b?.atual === "string" ? b.atual : "";
  const nova = senhaValida(b?.nova);
  if (!atual || atual.length > SENHA_MAXIMA || !nova) {
    return NextResponse.json(
      { error: `Nova senha deve ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres` },
      { status: 400 }
    );
  }
  const u = await db.usuarioPapel.findUnique({ where: { email: g.email } });
  if (!u?.senhaHash || !conferirSenha(atual, u.senhaHash)) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
  }
  const atualizado = await db.usuarioPapel.update({
    where: { email: g.email },
    data: { senhaHash: hashSenha(nova), sessaoVersao: { increment: 1 } },
    select: { sessaoVersao: true },
  });
  const r = NextResponse.json({ ok: true });
  r.cookies.set(
    NOME_COOKIE,
    criarToken({ email: g.email, papel: g.papel, nome: g.nome, sessaoVersao: atualizado.sessaoVersao }),
    OPCOES_COOKIE
  );
  return r;
}

export const POST = withApiError("trocar-senha.POST", postHandler);

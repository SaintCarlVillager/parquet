import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NOME_COOKIE, OPCOES_COOKIE, usuarioDaRequisicao } from "@/lib/auth";
import { withApiError } from "@/lib/errosApi";

function limparCookie(resposta: NextResponse): NextResponse {
  resposta.cookies.set(NOME_COOKIE, "", { ...OPCOES_COOKIE, maxAge: 0 });
  return resposta;
}

async function postHandler(req: Request) {
  const sessao = usuarioDaRequisicao(req);
  if (sessao) {
    await db.usuarioPapel.updateMany({
      where: { email: sessao.email, sessaoVersao: sessao.sessaoVersao },
      data: { sessaoVersao: { increment: 1 } },
    });
  }
  return limparCookie(NextResponse.json({ ok: true }));
}

export const POST = withApiError("logout.POST", postHandler, limparCookie);

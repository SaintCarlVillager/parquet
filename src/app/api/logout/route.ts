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
    await db.$executeRaw`UPDATE "UsuarioPapel" SET "sessaoVersao" = "sessaoVersao" + 1 WHERE "email" = ${sessao.email} AND "sessaoVersao" = ${sessao.sessaoVersao}`;
  }
  return limparCookie(NextResponse.json({ ok: true }));
}

export const POST = withApiError("logout.POST", postHandler, limparCookie);

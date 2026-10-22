import { NextResponse } from "next/server";
import { NOME_COOKIE, OPCOES_COOKIE } from "@/lib/auth";
import { withApiError } from "@/lib/errosApi";

async function postHandler() {
  const r = NextResponse.json({ ok: true });
  r.cookies.set(NOME_COOKIE, "", { ...OPCOES_COOKIE, maxAge: 0 });
  return r;
}

export const POST = withApiError("logout.POST", postHandler);

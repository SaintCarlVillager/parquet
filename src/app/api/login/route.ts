import { NextResponse } from "next/server";
import { NOME_COOKIE, OPCOES_COOKIE, autenticar, criarToken } from "@/lib/auth";
import { chavesLogin, limparFalhas, registrarFalha, verificarLimite } from "@/lib/loginRateLimit";
import { withApiError } from "@/lib/errosApi";

async function postHandler(req: Request) {
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > 8192) return NextResponse.json({ error: "Requisicao muito grande" }, { status: 413 });
  const corpo = (await req.json().catch(() => null)) as { email?: unknown; senha?: unknown } | null;
  if (typeof corpo?.email !== "string" || typeof corpo.senha !== "string") {
    return NextResponse.json({ error: "Informe e-mail e senha" }, { status: 400 });
  }
  const email = corpo.email.trim().toLowerCase();
  const senha = corpo.senha;
  if (!email || !senha || email.length > 254 || senha.length > 256) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }
  const chaves = chavesLogin(email, req);
  const limite = await verificarLimite(chaves);
  if (limite.bloqueado) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } }
    );
  }
  const s = await autenticar(email, senha);
  if (!s) {
    await registrarFalha(chaves);
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }
  await limparFalhas(chaves);
  const r = NextResponse.json({ email: s.email, nome: s.nome, papel: s.papel });
  r.cookies.set(NOME_COOKIE, criarToken({ email: s.email, papel: s.papel, nome: s.nome, sessaoVersao: s.sessaoVersao }), OPCOES_COOKIE);
  return r;
}

export const POST = withApiError("login.POST", postHandler);

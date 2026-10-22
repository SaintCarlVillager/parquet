import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export type Papel = "CHEFE" | "OFICIAL" | "PROMOTOR";

export const TODOS: Papel[] = ["CHEFE", "OFICIAL", "PROMOTOR"];
export const LEITURA: Papel[] = ["CHEFE", "OFICIAL"];
export const EDICAO: Papel[] = ["CHEFE"];
export const EDICAO_TROCAS: Papel[] = ["CHEFE", "OFICIAL"];

const COOKIE = "escala_sessao";
const DURACAO_S = 60 * 60 * 24 * 7;
const TAMANHO_MINIMO_SEGREDO = 32;

export type Sessao = { email: string; papel: Papel; nome: string; sessaoVersao: number; exp: number };

function carregarSegredo(): string {
  const valor = process.env.SESSION_SECRET?.trim();
  if (!valor || valor.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error("SESSION_SECRET ausente ou invalido");
  }
  return valor;
}

const SEGREDO = carregarSegredo();

function b64u(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64u(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function assinar(carga: string): string {
  return b64u(crypto.createHmac("sha256", SEGREDO).update(carga).digest());
}

export function hashSenha(senha: string): string {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

export function conferirSenha(senha: string, armazenado: string): boolean {
  const [salHex, hashHex] = armazenado.split(":");
  if (!salHex || !hashHex) return false;
  const hash = crypto.scryptSync(senha, Buffer.from(salHex, "hex"), 64);
  const esperado = Buffer.from(hashHex, "hex");
  return hash.length === esperado.length && crypto.timingSafeEqual(hash, esperado);
}

export function criarToken(sessao: Omit<Sessao, "exp">): string {
  const carga = b64u(Buffer.from(JSON.stringify({ ...sessao, exp: Date.now() + DURACAO_S * 1000 })));
  return `${carga}.${assinar(carga)}`;
}

export function lerToken(token: string | undefined): Sessao | null {
  if (!token) return null;
  const [carga, sig] = token.split(".");
  if (!carga || !sig) return null;
  const esperado = assinar(carga);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(deB64u(carga).toString()) as Sessao;
    if (!s.exp || s.exp < Date.now() || !Number.isInteger(s.sessaoVersao) || s.sessaoVersao < 0) return null;
    return s;
  } catch {
    return null;
  }
}

export function usuarioDaRequisicao(req: Request): Sessao | null {
  return lerToken(req.headers.get("cookie")?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1]);
}

async function validarSessao(sessao: Sessao | null): Promise<Sessao | null> {
  if (!sessao) return null;
  const usuario = await db.usuarioPapel.findUnique({
    where: { email: sessao.email },
    select: { email: true, nome: true, papel: true, senhaHash: true, sessaoVersao: true },
  });
  if (!usuario?.senhaHash || usuario.sessaoVersao !== sessao.sessaoVersao || usuario.papel !== sessao.papel) return null;
  if (usuario.papel !== "CHEFE" && usuario.papel !== "OFICIAL" && usuario.papel !== "PROMOTOR") return null;
  return { email: usuario.email, nome: usuario.nome ?? usuario.email, papel: usuario.papel, sessaoVersao: usuario.sessaoVersao, exp: sessao.exp };
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return validarSessao(lerToken(token));
}

export async function papelAtual(): Promise<Papel | null> {
  return (await sessaoAtual())?.papel ?? null;
}

export async function exigir(req: Request, papeis: Papel[]): Promise<Sessao | { erro: Response }> {
  const s = await validarSessao(usuarioDaRequisicao(req));
  if (!s) return { erro: Response.json({ error: "Nao autenticado" }, { status: 401 }) };
  if (!papeis.includes(s.papel)) {
    return { erro: Response.json({ error: "Sem permissao para esta operacao" }, { status: 403 }) };
  }
  return s;
}

export async function autenticar(email: string, senha: string): Promise<Sessao | null> {
  const u = await db.usuarioPapel.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u?.senhaHash || !conferirSenha(senha, u.senhaHash)) return null;
  if (u.papel !== "CHEFE" && u.papel !== "OFICIAL" && u.papel !== "PROMOTOR") return null;
  return { email: u.email, papel: u.papel, nome: u.nome ?? u.email, sessaoVersao: u.sessaoVersao, exp: 0 };
}

export const NOME_COOKIE = COOKIE;
export const MAX_AGE_S = DURACAO_S;

export const OPCOES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACAO_S,
  secure: process.env.NODE_ENV === "production",
};

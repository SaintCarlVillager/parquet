import crypto from "node:crypto";
import { db } from "./db";

const LIMITE_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;
const RETENCAO_MS = 24 * 60 * 60 * 1000;

function hashChave(valor: string): string {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

function chaves(email: string, req: Request): string[] {
  const resultado = [`email:${hashChave(email)}`];
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  if (ip) resultado.push(`ip:${hashChave(ip)}`);
  return resultado;
}

export function chavesLogin(email: string, req: Request): string[] {
  return chaves(email.trim().toLowerCase(), req);
}

export async function verificarLimite(chaves: string[]): Promise<{ bloqueado: boolean; retryAfter: number }> {
  const agora = Date.now();
  let retryAfter = 0;
  for (const chave of chaves) {
    const tentativa = await db.loginTentativa.findUnique({ where: { chave } });
    if (!tentativa?.bloqueadoAte) continue;
    const restante = tentativa.bloqueadoAte.getTime() - agora;
    if (restante > 0) retryAfter = Math.max(retryAfter, Math.ceil(restante / 1000));
  }
  return { bloqueado: retryAfter > 0, retryAfter };
}

export async function registrarFalha(chaves: string[]): Promise<void> {
  const agora = new Date();
  await db.loginTentativa.deleteMany({
    where: { atualizadoEm: { lt: new Date(agora.getTime() - RETENCAO_MS) } },
  });
  for (const chave of chaves) {
    const atual = await db.loginTentativa.findUnique({ where: { chave } });
    const janelaExpirada = !atual || agora.getTime() - atual.atualizadoEm.getTime() >= JANELA_MS;
    const falhas = janelaExpirada ? 1 : atual.falhas + 1;
    const bloqueadoAte = falhas >= LIMITE_FALHAS ? new Date(agora.getTime() + BLOQUEIO_MS) : null;
    await db.loginTentativa.upsert({
      where: { chave },
      create: { chave, falhas, bloqueadoAte, atualizadoEm: agora },
      update: { falhas, bloqueadoAte, atualizadoEm: agora },
    });
  }
}

export async function limparFalhas(chaves: string[]): Promise<void> {
  await db.loginTentativa.deleteMany({ where: { chave: { in: chaves } } });
}

export type ObjetoEntrada = Record<string, unknown>;

export function inteiroPositivo(valor: unknown): number | null {
  const numero = typeof valor === "number" && Number.isInteger(valor) ? valor : typeof valor === "string" && /^\d+$/.test(valor) ? Number(valor) : NaN;
  return Number.isSafeInteger(numero) && numero > 0 && numero <= 2147483647 ? numero : null;
}

export function numeroFinito(valor: unknown): number | null {
  const numero = typeof valor === "number" || (typeof valor === "string" && valor.trim() !== "") ? Number(valor) : NaN;
  return Number.isFinite(numero) ? numero : null;
}

export function texto(valor: unknown, limite: number, obrigatorio = false): string | null {
  if (typeof valor !== "string") return obrigatorio ? null : "";
  const resultado = valor.trim();
  if (obrigatorio && !resultado) return null;
  return resultado.length <= limite ? resultado : null;
}

export function textoOpcional(valor: unknown, limite: number): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return null;
  const resultado = valor.trim();
  return resultado.length <= limite ? resultado : null;
}

export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 256;

export function senhaValida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return valor.length >= SENHA_MINIMA && valor.length <= SENHA_MAXIMA ? valor : null;
}

export function dataISO(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? valor : null;
}

export function objeto(valor: unknown): ObjetoEntrada | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as ObjetoEntrada) : null;
}

export async function lerObjeto(req: Request): Promise<ObjetoEntrada | null> {
  return objeto(await req.json().catch(() => null));
}

export type TrocaMascara = { data: string; posicaoId: number | null; promotorOrigemId: number | null; promotorDestinoId: number };

export function aplicarTrocas<T extends { data: string; posicaoId: number; promotorId: number | null; origem: string }>(
  designacoes: T[],
  trocas: TrocaMascara[]
): (T & { trocaOrigemId?: number })[] {
  return designacoes.map((d) => {
    const troca = trocas.find((t) => t.data === d.data && t.posicaoId === d.posicaoId && t.promotorOrigemId === d.promotorId)
      ?? trocas.find((t) => t.data === d.data && t.posicaoId === null && t.promotorOrigemId !== null && t.promotorOrigemId === d.promotorId);
    if (!troca) return d;
    return { ...d, promotorId: troca.promotorDestinoId, origem: "TROCA", trocaOrigemId: troca.promotorOrigemId };
  });
}

import { db } from "@/lib/db";

type PromotorCarga = {
  id: number;
  portariasCobridor: { promotorCobridorId: number | null; promotorAfastadoId: number; inicio: string; fim: string }[];
};

export async function cargaAnterior(ano: number, mes: number, promotores: PromotorCarga[], pesos: Record<string, number>) {
  const escalas = await db.escala.findMany({
    where: { OR: [{ ano: { lt: ano } }, { ano, mes: { lt: mes } }] },
    include: { designacoes: { include: { posicao: { select: { grupo: true } } } } },
  });
  const cobridores = new Map(promotores.map((p) => [p.id, p.portariasCobridor]));
  const saldo = new Map<number, Record<string, number>>();
  for (const p of promotores) saldo.set(p.id, {});
  for (const escala of escalas) {
    for (const d of escala.designacoes) {
      if (!d.promotorId) continue;
      const cobertura = (cobridores.get(d.promotorId) ?? []).find(
        (pt) => pt.inicio <= d.data && d.data <= pt.fim && pt.promotorCobridorId === d.promotorId
      );
      const alvo = cobertura?.promotorAfastadoId ?? d.promotorId;
      const rec = saldo.get(alvo);
      if (!rec) continue;
      const grupo = d.posicao.grupo;
      rec[grupo] = (rec[grupo] ?? 0) + (pesos[grupo] ?? 1);
    }
  }
  return saldo;
}

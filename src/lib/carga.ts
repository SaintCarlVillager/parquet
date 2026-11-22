import { db } from "@/lib/db";

type LinhaCarga = { alvo: number; grupo: string; total: bigint | number };

function somaRepetida(peso: number, vezes: number, inicial: number): number {
  let total = inicial;
  for (let i = 0; i < vezes; i++) total += peso;
  return total;
}

export async function cargaAnterior(ano: number, mes: number, promotores: { id: number }[], pesos: Record<string, number>) {
  const linhas = await db.$queryRaw<LinhaCarga[]>`
    SELECT COALESCE(cob."promotorAfastadoId", d."promotorId") AS "alvo", p."grupo" AS "grupo", COUNT(*) AS "total"
    FROM "Designacao" d
    JOIN "Escala" e ON e."id" = d."escalaId"
    JOIN "Posicao" p ON p."id" = d."posicaoId"
    LEFT JOIN LATERAL (
      SELECT pt."promotorAfastadoId"
      FROM "Portaria" pt
      WHERE pt."promotorCobridorId" = d."promotorId" AND pt."inicio" <= d."data" AND d."data" <= pt."fim"
      ORDER BY pt."id"
      LIMIT 1
    ) cob ON true
    WHERE d."promotorId" IS NOT NULL AND (e."ano" < ${ano} OR (e."ano" = ${ano} AND e."mes" < ${mes}))
    GROUP BY 1, 2`;
  const saldo = new Map<number, Record<string, number>>();
  for (const p of promotores) saldo.set(p.id, {});
  for (const linha of linhas) {
    const rec = saldo.get(Number(linha.alvo));
    if (!rec) continue;
    rec[linha.grupo] = somaRepetida(pesos[linha.grupo] ?? 1, Number(linha.total), rec[linha.grupo] ?? 0);
  }
  return saldo;
}

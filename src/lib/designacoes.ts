import { db } from "./db";

export type LinhaDesignacao = {
  escalaId: number;
  data: string;
  posicaoId: number;
  promotorId: number | null;
  origem: string;
};

// Modo HTTP do Neon não suporta createMany (vira lote transacionado): INSERT multi-VALUES em uma sentença.
export async function inserirDesignacoes(rows: LinhaDesignacao[]): Promise<void> {
  if (rows.length === 0) return;
  const valores = rows.map((r) => {
    if (!Number.isInteger(r.escalaId) || !Number.isInteger(r.posicaoId)) {
      throw new Error("Ids invalidos para designacao");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) throw new Error("Data invalida para designacao");
    if (r.origem !== "AUTO" && r.origem !== "MANUAL") throw new Error("Origem invalida");
    const promotor = r.promotorId === null ? "NULL" : Number.isInteger(r.promotorId) ? String(r.promotorId) : "NULL";
    return `(${r.escalaId},'${r.data}',${r.posicaoId},${promotor},'${r.origem}')`;
  });
  await db.$executeRawUnsafe(
    `INSERT INTO "Designacao" ("escalaId","data","posicaoId","promotorId","origem") VALUES ${valores.join(",")}`
  );
}

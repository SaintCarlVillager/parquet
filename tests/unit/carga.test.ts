import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    escala: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { cargaAnterior } from "../../src/lib/carga";

function sqlDe(chamada: unknown[]): string {
  const [partes] = chamada as [TemplateStringsArray];
  return partes.join("?");
}

describe("cargaAnterior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soma a carga no banco em uma unica consulta, sem carregar o historico", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await cargaAnterior(2026, 9, [{ id: 1 }], { AUDIENCIAS: 1 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.escala.findMany).not.toHaveBeenCalled();
    const sql = sqlDe(db.$queryRaw.mock.calls[0]);
    expect(sql).toContain("GROUP BY");
    expect(sql).toContain('"promotorCobridorId"');
    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual([2026, 2026, 9]);
  });

  it("aplica o peso do grupo e aceita contagem em bigint", async () => {
    db.$queryRaw.mockResolvedValue([
      { alvo: 1, grupo: "AUDIENCIAS", total: BigInt(3) },
      { alvo: 1, grupo: "JURI", total: 2 },
      { alvo: 2, grupo: "AUDIENCIAS", total: BigInt(1) },
    ]);
    const saldo = await cargaAnterior(2026, 9, [{ id: 1 }, { id: 2 }, { id: 3 }], { AUDIENCIAS: 1.5, JURI: 2 });
    expect(saldo.get(1)).toEqual({ AUDIENCIAS: 4.5, JURI: 4 });
    expect(saldo.get(2)).toEqual({ AUDIENCIAS: 1.5 });
    expect(saldo.get(3)).toEqual({});
  });

  it("usa peso 1 para grupo sem peso e ignora promotor fora da lista", async () => {
    db.$queryRaw.mockResolvedValue([
      { alvo: 1, grupo: "OUTRO", total: BigInt(2) },
      { alvo: 99, grupo: "AUDIENCIAS", total: BigInt(5) },
    ]);
    const saldo = await cargaAnterior(2026, 1, [{ id: 1 }], {});
    expect(saldo.get(1)).toEqual({ OUTRO: 2 });
    expect(saldo.has(99)).toBe(false);
  });

  it("acumula o peso como a soma dia a dia fazia", async () => {
    db.$queryRaw.mockResolvedValue([{ alvo: 1, grupo: "AUDIENCIAS", total: BigInt(10) }]);
    const saldo = await cargaAnterior(2026, 9, [{ id: 1 }], { AUDIENCIAS: 0.1 });
    let esperado = 0;
    for (let i = 0; i < 10; i++) esperado += 0.1;
    expect(saldo.get(1)!.AUDIENCIAS).toBe(esperado);
  });
});

import { describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: { $executeRawUnsafe: vi.fn() } }));

vi.mock("@/lib/db", () => ({ db }));

import { substituirGrade } from "../../src/lib/escritasAtomicas";

describe("substituirGrade", () => {
  it("usa upsert e nao depende da ordem entre DELETE e INSERT", async () => {
    db.$executeRawUnsafe.mockResolvedValue(1);
    await substituirGrade(
      [{ grupo: "AUDIENCIAS", peso: 1 }],
      [{ diaSemana: 1, posicaoId: 2 }, { diaSemana: 2, posicaoId: 3 }]
    );
    const sql = db.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(db.$executeRawUnsafe).toHaveBeenCalled();
    expect(sql).toContain('INSERT INTO "GradeItem"');
    expect(sql).toContain('ON CONFLICT ("diaSemana","posicaoId") DO UPDATE');
    expect(sql).toMatch(/DELETE FROM "GradeItem"[\s\S]*WHERE/);
  });

  it("com lista vazia, remove todos os itens e nao insere nada", async () => {
    db.$executeRawUnsafe.mockClear();
    db.$executeRawUnsafe.mockResolvedValue(1);
    await substituirGrade([{ grupo: "AUDIENCIAS", peso: 1 }], []);
    const sql = db.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/DELETE FROM "GradeItem" WHERE NOT EXISTS/);
    expect(sql).not.toContain('INSERT INTO "GradeItem"');
  });
});

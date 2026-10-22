import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $executeRawUnsafe: execute } }));

import { atualizarDesignacoes, inserirPortarias, publicarPromotores, substituirGrade, substituirVinculosRegra } from "../../src/lib/escritasAtomicas";

describe("escritas atomicas compativeis com Neon HTTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("substitui vinculos de regra em uma unica instrucao SQL", async () => {
    await substituirVinculosRegra(7, [2, 3]);
    expect(execute).toHaveBeenCalledTimes(1);
    const sql = execute.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM "PromotorRegra"');
    expect(sql).toContain('INSERT INTO "PromotorRegra"');
    expect(sql).toContain("(2,7),(3,7)");
  });

  it("permite substituir grade vazia sem gerar INSERT vazio", async () => {
    await substituirGrade([], []);
    const sql = execute.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM "GradeItem"');
    expect(sql).not.toContain('INSERT INTO "GradeItem"');
  });

  it("rejeita designacao com data ou origem invalidas antes do banco", async () => {
    await expect(atualizarDesignacoes([], [{ escalaId: 2, data: "10/09/2026", posicaoId: 3, promotorId: null, origem: "AUTO" }])).rejects.toThrow("Data invalida");
    await expect(atualizarDesignacoes([], [{ escalaId: 2, data: "2026-09-10", posicaoId: 3, promotorId: null, origem: "INVALIDA" }])).rejects.toThrow("Origem invalida");
    await expect(atualizarDesignacoes([], [{ escalaId: 2, data: "2026-09-10", posicaoId: 3, promotorId: null, origem: "MANUAL" }])).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("publica portarias staged em uma unica instrucao", async () => {
    await inserirPortarias([
      {
        numero: "12/2026",
        promotorAfastadoId: 2,
        promotorCobridorId: null,
        modalidade: "DESIGNADO",
        inicio: "2026-09-01",
        fim: "2026-09-30",
        observacao: null,
      },
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
    const sql = execute.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO "Portaria"');
    expect(sql).toContain("12/2026");
  });

  it("rejeita portaria staged invalida antes da publicacao", async () => {
    await expect(
      inserirPortarias([
        {
          numero: null,
          promotorAfastadoId: 2,
          promotorCobridorId: null,
          modalidade: "DESIGNADO",
          inicio: "10/09/2026",
          fim: "2026-09-30",
          observacao: null,
        },
      ])
    ).rejects.toThrow("Data invalida");
    expect(execute).not.toHaveBeenCalled();
  });

  it("publica promotores, varas e cargos em uma unica instrucao", async () => {
    await publicarPromotores(
      [{ id: 4, apelido: "PJ", nome: "Promotor", email: null, tipo: "TITULAR", atuacao: "TODAS", ativo: true, generico: false, observacoes: "Nota", varas: [1, 2] }],
      [{ cargo: "SECRETARIO", apelido: "PJ" }]
    );
    expect(execute).toHaveBeenCalledTimes(1);
    const sql = execute.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE "Promotor"');
    expect(sql).toContain('"observacoes" = v.observacoes');
    expect(sql).toContain("'Nota'");
    expect(sql).toContain('INSERT INTO "PromotorVara"');
    expect(sql).toContain('INSERT INTO "CargoAdministrativo"');
  });

  it("deduplica varas do mesmo promotor antes de publicar", async () => {
    await publicarPromotores(
      [{ id: 4, apelido: "PJ", nome: "Promotor", email: null, tipo: "TITULAR", atuacao: "TODAS", ativo: true, generico: false, observacoes: null, varas: [1, 1, 2] }],
      []
    );
    const sql = execute.mock.calls[0][0] as string;
    expect(sql.match(/\('PJ',1\)/g)).toHaveLength(1);
    expect(sql.match(/\('PJ',2\)/g)).toHaveLength(1);
  });
});

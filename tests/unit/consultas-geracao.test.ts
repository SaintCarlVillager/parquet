import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, inserirDesignacoes, atualizarDesignacoes } = vi.hoisted(() => ({
  db: {
    promotor: { findMany: vi.fn() },
    posicao: { findMany: vi.fn() },
    gradeItem: { findMany: vi.fn() },
    feriado: { findMany: vi.fn() },
    gradeExcecao: { findMany: vi.fn() },
    grupoCarga: { findMany: vi.fn() },
    cargoAdministrativo: { findMany: vi.fn() },
    escala: { findMany: vi.fn(), upsert: vi.fn() },
    designacao: { findMany: vi.fn() },
    troca: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  inserirDesignacoes: vi.fn(async (_linhas: unknown[]) => undefined),
  atualizarDesignacoes: vi.fn(async (
    _atualizacoes: { id: number; promotorId: number | null }[],
    _novas: { data: string; posicaoId: number; promotorId: number | null }[]
  ) => undefined),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/designacoes", () => ({ inserirDesignacoes }));
vi.mock("@/lib/escritasAtomicas", () => ({ atualizarDesignacoes }));

import { criarEsqueletoMes, gerarEscalaMes } from "../../src/lib/escalaService";

const AUDIENCIA = 1;
const CUSTODIA = 2;

function promotor(id: number, apelido: string) {
  return {
    id,
    nome: apelido,
    apelido,
    email: null,
    tipo: "TITULAR",
    atuacao: "TODAS",
    ativo: true,
    generico: false,
    observacoes: null,
    bloqueios: [],
    varas: [{ vara: 1 }],
    regras: [],
    portariasAfastado: [],
    portariasCobridor: [],
  };
}

function base(designacoes: { id: number; data: string; posicaoId: number; promotorId: number | null; origem: string }[] = []) {
  db.promotor.findMany.mockResolvedValue([promotor(1, "Ana"), promotor(2, "Bia")]);
  db.posicao.findMany.mockResolvedValue([
    { id: AUDIENCIA, codigo: "1", nome: "Vara 1", grupo: "AUDIENCIAS", ordem: 1 },
    { id: CUSTODIA, codigo: "C", nome: "Custodia", grupo: "CUSTODIA", ordem: 2 },
  ]);
  db.gradeItem.findMany.mockResolvedValue([{ id: 1, diaSemana: 2, posicaoId: AUDIENCIA }]);
  db.feriado.findMany.mockResolvedValue([]);
  db.gradeExcecao.findMany.mockResolvedValue([]);
  db.grupoCarga.findMany.mockResolvedValue([{ grupo: "AUDIENCIAS", nome: "Audiencias", peso: 1 }]);
  db.cargoAdministrativo.findMany.mockResolvedValue([]);
  db.escala.findMany.mockResolvedValue([]);
  db.escala.upsert.mockResolvedValue({ id: 3, ano: 2026, mes: 9, status: "RASCUNHO" });
  db.troca.findMany.mockResolvedValue([]);
  db.designacao.findMany.mockResolvedValue(designacoes);
  db.$queryRaw.mockResolvedValue([]);
}

describe("consultas da geracao do mes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("le cada cadastro uma unica vez", async () => {
    base();
    await gerarEscalaMes(2026, 9);
    expect(db.posicao.findMany).toHaveBeenCalledTimes(1);
    expect(db.gradeItem.findMany).toHaveBeenCalledTimes(1);
    expect(db.feriado.findMany).toHaveBeenCalledTimes(1);
    expect(db.gradeExcecao.findMany).toHaveBeenCalledTimes(1);
    expect(db.promotor.findMany).toHaveBeenCalledTimes(1);
  });

  it("le as designacoes do mes uma vez depois do esqueleto e uma vez durante ele", async () => {
    base();
    await gerarEscalaMes(2026, 9);
    expect(db.designacao.findMany).toHaveBeenCalledTimes(2);
  });

  it("calcula a carga anterior sem carregar as escalas antigas", async () => {
    base();
    await gerarEscalaMes(2026, 9);
    expect(db.escala.findMany).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("continua respeitando a custodia lancada ao distribuir o dia", async () => {
    base([{ id: 50, data: "2026-09-01", posicaoId: CUSTODIA, promotorId: 1, origem: "MANUAL" }]);
    await gerarEscalaMes(2026, 9);
    const [, novas] = atualizarDesignacoes.mock.calls.at(-1)!;
    const dia1 = novas.find((linha) => linha.data === "2026-09-01" && linha.posicaoId === AUDIENCIA);
    expect(dia1?.promotorId).toBe(2);
  });

  it("criarEsqueletoMes sozinho ainda busca os cadastros", async () => {
    base();
    await criarEsqueletoMes(2026, 9);
    expect(db.posicao.findMany).toHaveBeenCalledTimes(1);
    expect(db.gradeItem.findMany).toHaveBeenCalledTimes(1);
    expect(inserirDesignacoes).toHaveBeenCalledTimes(1);
  });
});

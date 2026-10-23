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
    $executeRawUnsafe: vi.fn(),
  },
  inserirDesignacoes: vi.fn(async (_linhas: unknown[]) => undefined),
  atualizarDesignacoes: vi.fn(async (
    _atualizacoes: { id: number; promotorId: number | null }[],
    _novas: { posicaoId: number; promotorId: number | null }[]
  ) => undefined),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/designacoes", () => ({ inserirDesignacoes }));
vi.mock("@/lib/escritasAtomicas", () => ({ atualizarDesignacoes }));

import { deveLiberarReservaPjs, gerarEscalaMes } from "../../src/lib/escalaService";

const POSICAO_AUX = 2;
const TITULAR_ID = 1;
const AFASTADO_ID = 2;
const PJS_ID = 9;

function promotor(parcial: {
  id: number;
  apelido: string;
  tipo: string;
  generico?: boolean;
  varas?: number[];
  portariasAfastado?: { promotorAfastadoId: number; promotorCobridorId: number | null; inicio: string; fim: string }[];
  portariasCobridor?: { promotorAfastadoId: number; promotorCobridorId: number | null; inicio: string; fim: string }[];
}) {
  return {
    id: parcial.id,
    nome: parcial.apelido,
    apelido: parcial.apelido,
    email: null,
    tipo: parcial.tipo,
    atuacao: "TODAS",
    ativo: true,
    generico: parcial.generico ?? false,
    observacoes: null,
    bloqueios: [],
    varas: (parcial.varas ?? []).map((vara) => ({ vara })),
    regras: [],
    portariasAfastado: parcial.portariasAfastado ?? [],
    portariasCobridor: parcial.portariasCobridor ?? [],
  };
}

function base(opcoes: {
  promotores: ReturnType<typeof promotor>[];
  designacoes?: { id: number; data: string; posicaoId: number; promotorId: number | null; origem: string }[];
}) {
  db.promotor.findMany.mockResolvedValue(opcoes.promotores);
  db.posicao.findMany.mockResolvedValue([{ id: POSICAO_AUX, codigo: "1'", nome: "Auxiliar 1", grupo: "AUDIENCIAS", ordem: 1 }]);
  db.gradeItem.findMany.mockResolvedValue([{ id: 1, diaSemana: 2, posicaoId: POSICAO_AUX }]);
  db.feriado.findMany.mockResolvedValue([]);
  db.gradeExcecao.findMany.mockResolvedValue([]);
  db.grupoCarga.findMany.mockResolvedValue([{ grupo: "AUDIENCIAS", nome: "Audiencias", peso: 1 }]);
  db.cargoAdministrativo.findMany.mockResolvedValue([]);
  db.escala.findMany.mockResolvedValue([]);
  db.escala.upsert.mockResolvedValue({ id: 3, ano: 2026, mes: 9, status: "RASCUNHO" });
  db.troca.findMany.mockResolvedValue([]);
  db.designacao.findMany.mockImplementation(async (args: { where?: { posicao?: { codigo?: string } } }) => {
    if (args?.where?.posicao?.codigo === "C") return [];
    return opcoes.designacoes ?? [];
  });
}

function gravacao() {
  const chamada = atualizarDesignacoes.mock.calls.at(-1);
  expect(chamada).toBeTruthy();
  const [atualizacoes, novas] = chamada!;
  return { atualizacoes, novas };
}

const titular = () => promotor({ id: TITULAR_ID, apelido: "Ana", tipo: "TITULAR", varas: [1] });
const pjs = (extra?: Parameters<typeof promotor>[0]["portariasCobridor"]) =>
  promotor({
    id: PJS_ID,
    apelido: "PJS",
    tipo: "SUBSTITUTO",
    generico: true,
    portariasCobridor: extra,
  });

describe("reserva diaria do PJS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconhece a designacao automatica do PJS numa auxiliar sem cobertura", () => {
    expect(
      deveLiberarReservaPjs({ promotorId: PJS_ID, origem: "AUTO", codigo: "1'", pjsId: PJS_ID, herdadaPelaPortaria: false })
    ).toBe(true);
    expect(
      deveLiberarReservaPjs({ promotorId: PJS_ID, origem: "MANUAL", codigo: "1'", pjsId: PJS_ID, herdadaPelaPortaria: false })
    ).toBe(false);
    expect(
      deveLiberarReservaPjs({ promotorId: PJS_ID, origem: "AUTO", codigo: "1", pjsId: PJS_ID, herdadaPelaPortaria: false })
    ).toBe(false);
    expect(
      deveLiberarReservaPjs({ promotorId: PJS_ID, origem: "AUTO", codigo: "1'", pjsId: PJS_ID, herdadaPelaPortaria: true })
    ).toBe(false);
    expect(
      deveLiberarReservaPjs({ promotorId: TITULAR_ID, origem: "AUTO", codigo: "1'", pjsId: PJS_ID, herdadaPelaPortaria: false })
    ).toBe(false);
    expect(
      deveLiberarReservaPjs({ promotorId: PJS_ID, origem: "AUTO", codigo: "1'", pjsId: null, herdadaPelaPortaria: false })
    ).toBe(false);
  });

  it("nao pre-aloca o PJS na auxiliar livre", async () => {
    base({ promotores: [titular(), pjs()] });
    await gerarEscalaMes(2026, 9);
    const { novas } = gravacao();
    const auxiliares = novas.filter((linha) => linha.posicaoId === POSICAO_AUX);
    expect(auxiliares.length).toBeGreaterThan(0);
    expect(auxiliares.every((linha) => linha.promotorId === TITULAR_ID)).toBe(true);
  });

  it("solta a reserva automatica ja gravada para um promotor real assumir", async () => {
    base({
      promotores: [titular(), pjs()],
      designacoes: [{ id: 40, data: "2026-09-01", posicaoId: POSICAO_AUX, promotorId: PJS_ID, origem: "AUTO" }],
    });
    await gerarEscalaMes(2026, 9);
    const { atualizacoes, novas } = gravacao();
    expect(atualizacoes).toContainEqual({ id: 40, promotorId: TITULAR_ID });
    expect(novas.every((linha) => linha.promotorId !== PJS_ID)).toBe(true);
  });

  it("preserva o PJS lancado a mao", async () => {
    base({
      promotores: [titular(), pjs()],
      designacoes: [{ id: 41, data: "2026-09-01", posicaoId: POSICAO_AUX, promotorId: PJS_ID, origem: "MANUAL" }],
    });
    await gerarEscalaMes(2026, 9);
    const { atualizacoes } = gravacao();
    expect(atualizacoes.find((linha) => linha.id === 41)).toBeUndefined();
  });

  it("mantem o PJS na auxiliar quando ele cobre o afastado por portaria", async () => {
    const portaria = {
      promotorAfastadoId: AFASTADO_ID,
      promotorCobridorId: PJS_ID,
      inicio: "2026-09-01",
      fim: "2026-09-30",
    };
    base({
      promotores: [
        titular(),
        promotor({ id: AFASTADO_ID, apelido: "Bia", tipo: "AUXILIAR", varas: [1], portariasAfastado: [portaria] }),
        pjs([portaria]),
      ],
      designacoes: [{ id: 42, data: "2026-09-01", posicaoId: POSICAO_AUX, promotorId: PJS_ID, origem: "AUTO" }],
    });
    await gerarEscalaMes(2026, 9);
    const { atualizacoes, novas } = gravacao();
    expect(atualizacoes.find((linha) => linha.id === 42)).toBeUndefined();
    const herdadas = novas.filter((linha) => linha.posicaoId === POSICAO_AUX);
    expect(herdadas.length).toBeGreaterThan(0);
    expect(herdadas.every((linha) => linha.promotorId === PJS_ID)).toBe(true);
  });
});

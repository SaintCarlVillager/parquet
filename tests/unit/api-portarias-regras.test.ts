import { beforeEach, describe, expect, it, vi } from "vitest";

const { portariaDb, regraDb, exigir, substituirVinculosRegra } = vi.hoisted(() => ({
  portariaDb: { portaria: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, promotor: { findMany: vi.fn() } },
  regraDb: { regra: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() } },
  exigir: vi.fn(),
  substituirVinculosRegra: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { ...portariaDb, ...regraDb } }));
vi.mock("@/lib/auth", () => ({ EDICAO: ["CHEFE"], TODOS: ["CHEFE", "OFICIAL", "PROMOTOR"], exigir }));
vi.mock("@/lib/escritasAtomicas", () => ({ substituirVinculosRegra }));

import { POST as criarPortaria } from "../../src/app/api/portarias/route";
import { PUT as atualizarPortaria } from "../../src/app/api/portarias/[id]/route";
import { POST as criarRegra } from "../../src/app/api/regras/route";
import { PUT as atualizarRegra } from "../../src/app/api/regras/[id]/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body: unknown, path: string) {
  return new Request(`http://teste${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

function requisicaoBruta(body: string, path: string) {
  return new Request(`http://teste${path}`, { method: "POST", body, headers: { "content-type": "application/json" } });
}

describe("APIs de portarias e regras", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
  });

  it("rejeita portaria com afastado igual ao cobridor", async () => {
    const resposta = await criarPortaria(requisicao({ promotorAfastadoId: 4, promotorCobridorId: 4, inicio: "2026-09-01", fim: "2026-09-30", modalidade: "DESIGNADO" }, "/api/portarias"));
    expect(resposta.status).toBe(400);
    expect(portariaDb.portaria.create).not.toHaveBeenCalled();
  });

  it("cria portaria sem include no write e lê a relação depois", async () => {
    portariaDb.portaria.create.mockResolvedValue({ id: 8 });
    portariaDb.portaria.findUnique.mockResolvedValue({ id: 8, modalidade: "ACUMULACAO" });
    const resposta = await criarPortaria(requisicao({ promotorAfastadoId: 4, promotorCobridorId: 5, inicio: "2026-09-01", fim: "2026-09-30", modalidade: "ACUMULACAO", numero: " 12/2026 ", observacao: " teste " }, "/api/portarias"));
    expect(resposta.status).toBe(201);
    expect(portariaDb.portaria.create).toHaveBeenCalledWith({ data: { promotorAfastadoId: 4, promotorCobridorId: 5, modalidade: "ACUMULACAO", inicio: "2026-09-01", fim: "2026-09-30", numero: "12/2026", observacao: "teste" } });
    expect(portariaDb.portaria.findUnique).toHaveBeenCalled();
  });

  it("valida dias e grupos da regra antes de gravar", async () => {
    const diasInvalidos = await criarRegra(requisicao({ nome: "Regra", dias: [7], grupos: ["AUDIENCIAS"] }, "/api/regras"));
    const grupoInvalido = await criarRegra(requisicao({ nome: "Regra", dias: [1], grupos: [""] }, "/api/regras"));
    expect(diasInvalidos.status).toBe(400);
    expect(grupoInvalido.status).toBe(400);
    expect(regraDb.regra.create).not.toHaveBeenCalled();
  });

  it("deduplica dias, grupos e promotores ao criar regra", async () => {
    regraDb.regra.create.mockResolvedValue({ id: 9 });
    regraDb.regra.findUnique.mockResolvedValue({ id: 9, nome: "Regra" });
    const resposta = await criarRegra(requisicao({ nome: "  Regra ", tipo: "EXCETO", dias: [3, 1, 3], grupos: ["AUDIENCIAS", "AUDIENCIAS"], promotoresIds: [2, "2"] }, "/api/regras"));
    expect(resposta.status).toBe(201);
    expect(regraDb.regra.create).toHaveBeenCalledWith({ data: { nome: "Regra", tipo: "EXCETO", diasCsv: "1,3", gruposCsv: "AUDIENCIAS" } });
    expect(substituirVinculosRegra).toHaveBeenCalledWith(9, [2]);
  });

  it("valida promotoresIds antes de criar a regra", async () => {
    const resposta = await criarRegra(requisicao({ nome: "Regra", dias: [1], grupos: [], promotoresIds: ["abc"] }, "/api/regras"));
    expect(resposta.status).toBe(400);
    expect(regraDb.regra.create).not.toHaveBeenCalled();
  });

  it("valida promotoresIds antes de atualizar a regra", async () => {
    regraDb.regra.findUnique.mockResolvedValue({ id: 9 });
    const resposta = await atualizarRegra(requisicao({ nome: "Regra", dias: [1], grupos: [], promotoresIds: ["abc"] }, "/api/regras/9"), { params: Promise.resolve({ id: "9" }) });
    expect(resposta.status).toBe(400);
    expect(regraDb.regra.update).not.toHaveBeenCalled();
  });

  it("rejeita JSON invalido, nulo, array e textos opcionais incorretos em portarias", async () => {
    const invalido = await criarPortaria(requisicaoBruta("{", "/api/portarias"));
    const nulo = await criarPortaria(requisicao(null, "/api/portarias"));
    const lista = await criarPortaria(requisicao([], "/api/portarias"));
    const tipoInvalido = await criarPortaria(requisicao({ promotorAfastadoId: 4, promotorCobridorId: 5, inicio: "2026-09-01", fim: "2026-09-30", numero: 12 }, "/api/portarias"));
    expect([invalido.status, nulo.status, lista.status, tipoInvalido.status]).toEqual([400, 400, 400, 400]);
    expect(portariaDb.portaria.create).not.toHaveBeenCalled();
  });

  it("rejeita JSON invalido na atualizacao de portaria antes da leitura", async () => {
    const resposta = await atualizarPortaria(requisicaoBruta("{", "/api/portarias/8"), { params: Promise.resolve({ id: "8" }) });
    expect(resposta.status).toBe(400);
    expect(portariaDb.portaria.findUnique).not.toHaveBeenCalled();
    expect(portariaDb.portaria.update).not.toHaveBeenCalled();
  });
});

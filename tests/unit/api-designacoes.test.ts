import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir } = vi.hoisted(() => ({
  db: {
    designacao: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    promotor: { findUnique: vi.fn(), findMany: vi.fn() },
    promotorVara: { findMany: vi.fn() },
    promotorRegra: { findMany: vi.fn() },
    cargoAdministrativo: { findMany: vi.fn() },
    portaria: { findMany: vi.fn() },
  },
  exigir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ EDICAO: ["CHEFE"], exigir }));

import { PATCH } from "../../src/app/api/designacoes/[id]/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function params(id = "4") {
  return { params: Promise.resolve({ id }) };
}

function requisicao(body: unknown = {}) {
  return new Request("http://teste/api/designacoes/4", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("API de designacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
    db.promotorVara.findMany.mockResolvedValue([]);
    db.promotorRegra.findMany.mockResolvedValue([]);
    db.promotor.findMany.mockResolvedValue([]);
    db.cargoAdministrativo.findMany.mockResolvedValue([]);
    db.portaria.findMany.mockResolvedValue([]);
  });

  it("retorna 404 para designacao inexistente", async () => {
    db.designacao.findUnique.mockResolvedValue(null);
    const resposta = await PATCH(requisicao({ promotorId: null }), params());
    expect(resposta.status).toBe(404);
  });

  it("impede edicao de escala publicada e celula travada", async () => {
    db.designacao.findUnique.mockResolvedValue({ escala: { status: "PUBLICADA" }, posicao: {} });
    expect((await PATCH(requisicao({ promotorId: null }), params())).status).toBe(409);

    db.designacao.findUnique.mockResolvedValue({ escala: { status: "RASCUNHO" }, travada: true, posicao: {} });
    const resposta = await PATCH(requisicao({ promotorId: null }), params());
    expect(resposta.status).toBe(409);
    expect(db.designacao.update).not.toHaveBeenCalled();
  });

  it("permite forcar celula travada e grava origem manual", async () => {
    db.designacao.findUnique.mockResolvedValue({ id: 4, escala: { status: "RASCUNHO" }, travada: true, posicao: { codigo: "C", grupo: "CUSTODIA" }, posicaoId: 3, escalaId: 1, data: "2026-09-10" });
    db.designacao.update.mockResolvedValue({ id: 4, promotorId: 2, origem: "MANUAL" });
    db.promotor.findUnique.mockResolvedValue({ id: 2, apelido: "PJ", ativo: true, atuacao: "TODAS", tipo: "TITULAR", generico: false, varas: [], bloqueios: [], regras: [], portariasAfastado: [], portariasCobridor: [] });
    const resposta = await PATCH(requisicao({ promotorId: 2, forcar: true }), params());
    expect(resposta.status).toBe(200);
    expect(db.designacao.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { promotorId: 2, origem: "MANUAL" } });
  });

  it("recusa corpo com JSON invalido com 400", async () => {
    const invalida = new Request("http://teste/api/designacoes/4", { method: "PATCH", body: "{nao-e-json", headers: { "content-type": "application/json" } });
    expect((await PATCH(invalida, params())).status).toBe(400);
    expect(db.designacao.findUnique).not.toHaveBeenCalled();
  });

  it("destrava e trava a celula por PATCH explicito de travada", async () => {
    db.designacao.findUnique.mockResolvedValue({ id: 4, escala: { status: "RASCUNHO" }, travada: true, posicao: { codigo: "C", grupo: "CUSTODIA" }, posicaoId: 3, escalaId: 1, data: "2026-09-10" });
    db.designacao.update.mockResolvedValue({ id: 4, travada: false });
    const destravar = await PATCH(requisicao({ travada: false }), params());
    expect(destravar.status).toBe(200);
    expect(db.designacao.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { travada: false } });

    db.designacao.findUnique.mockResolvedValue({ id: 4, escala: { status: "RASCUNHO" }, travada: false, posicao: { codigo: "C", grupo: "CUSTODIA" }, posicaoId: 3, escalaId: 1, data: "2026-09-10" });
    db.designacao.update.mockResolvedValue({ id: 4, travada: true });
    const travar = await PATCH(requisicao({ travada: true }), params());
    expect(travar.status).toBe(200);
    expect(db.designacao.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { travada: true } });
  });

  it("recusa travada sem ser booleano", async () => {
    db.designacao.findUnique.mockResolvedValue({ id: 4, escala: { status: "RASCUNHO" }, travada: false, posicao: { codigo: "C", grupo: "CUSTODIA" }, posicaoId: 3, escalaId: 1, data: "2026-09-10" });
    const resposta = await PATCH(requisicao({ travada: "sim" }), params());
    expect(resposta.status).toBe(400);
    expect(db.designacao.update).not.toHaveBeenCalled();
  });
});

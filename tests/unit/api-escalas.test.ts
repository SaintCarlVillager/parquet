import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir, criarEsqueletoMes, gerarEscalaMes } = vi.hoisted(() => ({
  db: { escala: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() } },
  exigir: vi.fn(),
  criarEsqueletoMes: vi.fn(),
  gerarEscalaMes: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ EDICAO: ["CHEFE"], TODOS: ["CHEFE", "OFICIAL", "PROMOTOR"], exigir }));
vi.mock("@/lib/escalaService", () => ({ criarEsqueletoMes, gerarEscalaMes }));

import { POST as criar } from "../../src/app/api/escalas/route";
import { PATCH as patchEscala } from "../../src/app/api/escalas/[id]/route";
import { POST as gerar } from "../../src/app/api/escalas/[id]/gerar/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body: unknown) {
  return new Request("http://teste/api/escalas", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("API de escalas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
  });

  it("valida mes e ano antes de criar o esqueleto", async () => {
    expect((await criar(requisicao({ ano: 1999, mes: 13 }))).status).toBe(400);
    expect((await criar(requisicao({ ano: 2026, mes: 0 }))).status).toBe(400);
    expect(criarEsqueletoMes).not.toHaveBeenCalled();
  });

  it("cria esqueleto sem gerar designacoes automaticamente", async () => {
    criarEsqueletoMes.mockResolvedValue({ id: 7, ano: 2026, mes: 9, status: "RASCUNHO" });
    const resposta = await criar(requisicao({ ano: 2026, mes: 9 }));
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ id: 7, ano: 2026, mes: 9, status: "RASCUNHO" });
    expect(criarEsqueletoMes).toHaveBeenCalledWith(2026, 9);
    expect(gerarEscalaMes).not.toHaveBeenCalled();
  });

  it("nao expoe detalhes da falha interna e retorna errorId", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    criarEsqueletoMes.mockRejectedValue(new Error("SQL secreto do banco"));

    const resposta = await criar(requisicao({ ano: 2026, mes: 9 }));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(500);
    expect(corpo.erro).toBe("Erro interno do servidor");
    expect(corpo.errorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(corpo)).not.toContain("SQL secreto");
    expect(log).toHaveBeenCalledWith("API_ERROR", expect.objectContaining({ errorId: corpo.errorId }));
    log.mockRestore();
  });

  it("nao gera escala publicada", async () => {
    db.escala.findUnique.mockResolvedValue({ id: 7, ano: 2026, mes: 9, status: "PUBLICADA" });
    const resposta = await gerar(new Request("http://teste/api/escalas/7", { method: "POST" }), { params: Promise.resolve({ id: "7" }) });
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).erro).toContain("reabra-a");
    expect(gerarEscalaMes).not.toHaveBeenCalled();
  });

  it("rejeita JSON malformado como erro de entrada", async () => {
    const resposta = await criar(new Request("http://teste/api/escalas", { method: "POST", body: "{", headers: { "content-type": "application/json" } }));
    expect(resposta.status).toBe(400);
    expect(criarEsqueletoMes).not.toHaveBeenCalled();
  });

  it("retorna 404 para escala inexistente", async () => {
    db.escala.findUnique.mockResolvedValue(null);
    const resposta = await gerar(new Request("http://teste/api/escalas/999", { method: "POST" }), { params: Promise.resolve({ id: "999" }) });
    expect(resposta.status).toBe(404);
  });

  it("valida observacao no PATCH da escala", async () => {
    const params = { params: Promise.resolve({ id: "7" }) };
    const patch = (body: string) =>
      new Request("http://teste/api/escalas/7", { method: "PATCH", body, headers: { "content-type": "application/json" } });

    expect((await patchEscala(patch("{invalido"), params)).status).toBe(400);

    db.escala.findUnique.mockResolvedValue({ id: 7, status: "RASCUNHO" });
    expect((await patchEscala(patch(JSON.stringify({ observacao: 123 })), params)).status).toBe(400);
    expect((await patchEscala(patch(JSON.stringify({ observacao: "x".repeat(501) })), params)).status).toBe(400);
    expect(db.escala.update).not.toHaveBeenCalled();

    db.escala.update.mockResolvedValue({ id: 7, observacao: "ferias" });
    const ok = await patchEscala(patch(JSON.stringify({ observacao: "ferias" })), params);
    expect(ok.status).toBe(200);
    expect(db.escala.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { observacao: "ferias" } });
  });
});

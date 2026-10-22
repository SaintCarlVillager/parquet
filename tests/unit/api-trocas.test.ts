import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir } = vi.hoisted(() => ({
  db: {
    escala: { findFirst: vi.fn() },
    designacao: { findUnique: vi.fn() },
    promotor: { findUnique: vi.fn() },
    troca: { findUnique: vi.fn(), create: vi.fn() },
    usuarioPapel: { findMany: vi.fn() },
  },
  exigir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ EDICAO_TROCAS: ["CHEFE", "OFICIAL"], TODOS: ["CHEFE", "OFICIAL", "PROMOTOR"], exigir }));

import { POST } from "../../src/app/api/trocas/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body: unknown) {
  return new Request("http://teste/api/trocas", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("API de trocas e ajustes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
    db.escala.findFirst.mockResolvedValue({ id: 10 });
    db.designacao.findUnique.mockResolvedValue({ promotorId: 1 });
    db.promotor.findUnique.mockResolvedValue({ id: 2, ativo: true });
    db.troca.findUnique.mockResolvedValue(null);
    db.troca.create.mockResolvedValue({ id: 20 });
    db.troca.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 20, data: "2026-09-10" });
  });

  it("rejeita payload incompleto antes de consultar o banco", async () => {
    const resposta = await POST(requisicao({ data: "2026-09-10" }));
    expect(resposta.status).toBe(400);
    expect(db.escala.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita ajuste de vaga quando feito por Oficial", async () => {
    exigir.mockResolvedValue({ ...chefe, papel: "OFICIAL", email: "oficial@teste" });
    const resposta = await POST(requisicao({ data: "2026-09-10", posicaoId: 1, promotorOrigemId: "VAGA", promotorDestinoId: 2 }));
    expect(resposta.status).toBe(403);
    expect(db.escala.findFirst).not.toHaveBeenCalled();
  });

  it("retorna conflito quando a escala do mes nao existe", async () => {
    db.escala.findFirst.mockResolvedValue(null);
    const resposta = await POST(requisicao({ data: "2026-09-10", posicaoId: 1, promotorOrigemId: 1, promotorDestinoId: 2 }));
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).erro).toContain("Gere a escala");
  });

  it("cria ajuste valido depois de conferir designacao e destino", async () => {
    const resposta = await POST(requisicao({ data: "2026-09-10", posicaoId: 1, promotorOrigemId: 1, promotorDestinoId: 2, observacao: "Cobertura" }));
    expect(resposta.status).toBe(201);
    expect(db.troca.create).toHaveBeenCalledWith({ data: { data: "2026-09-10", posicaoId: 1, promotorOrigemId: 1, promotorDestinoId: 2, observacao: "Cobertura" } });
  });
});

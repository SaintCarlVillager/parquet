import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir, substituirVaras } = vi.hoisted(() => ({
  db: { promotor: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
  exigir: vi.fn(),
  substituirVaras: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ TODOS: ["CHEFE", "OFICIAL", "PROMOTOR"], exigir: (...args: unknown[]) => exigir(...args) }));
vi.mock("@/lib/escritasAtomicas", () => ({ substituirVaras }));

import { GET, POST } from "../../src/app/api/promotores/route";
import { PATCH } from "../../src/app/api/promotores/[id]/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };
function requisicao(body: unknown, method = "POST", path = "/api/promotores") {
  return new Request(`http://teste${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("API de promotores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
  });

  it("cria promotor com observações normalizadas", async () => {
    db.promotor.findUnique.mockResolvedValue(null);
    db.promotor.create.mockResolvedValue({ id: 1, apelido: "PJ", observacoes: "Detalhe importante" });
    const resposta = await POST(requisicao({ nome: "Promotor", apelido: "PJ", observacoes: "  Detalhe importante  " }));
    expect(resposta.status).toBe(201);
    expect(db.promotor.create).toHaveBeenCalledWith({ data: expect.objectContaining({ observacoes: "Detalhe importante" }) });
  });

  it("rejeita observações inválidas antes de gravar", async () => {
    db.promotor.findUnique.mockResolvedValue(null);
    const longa = await POST(requisicao({ nome: "Promotor", apelido: "PJ", observacoes: "x".repeat(2001) }));
    const tipoInvalido = await POST(requisicao({ nome: "Promotor", apelido: "PJ", observacoes: 42 }));
    expect([longa.status, tipoInvalido.status]).toEqual([400, 400]);
    expect(db.promotor.create).not.toHaveBeenCalled();
  });

  it("impede criação para usuário sem autorização", async () => {
    exigir.mockResolvedValue({ erro: new Response(null, { status: 403 }) });
    const resposta = await POST(requisicao({ nome: "Promotor", apelido: "PJ", observacoes: "Nota" }));
    expect(resposta.status).toBe(403);
    expect(db.promotor.findUnique).not.toHaveBeenCalled();
    expect(db.promotor.create).not.toHaveBeenCalled();
  });

  it("atualiza observações separadamente e retorna varas normalizadas", async () => {
    db.promotor.update.mockResolvedValue({ id: 1 });
    db.promotor.findUnique.mockResolvedValue({ id: 1, observacoes: "Nota", varas: [{ vara: 2 }] });
    const resposta = await PATCH(requisicao({ observacoes: " Nota " }, "PATCH", "/api/promotores/1"), { params: Promise.resolve({ id: "1" }) });
    expect(resposta.status).toBe(200);
    expect(db.promotor.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { observacoes: "Nota" } });
    expect(await resposta.json()).toMatchObject({ observacoes: "Nota", varas: [{ vara: 2 }] });
  });

  it("inclui observações no cadastro retornado pela listagem", async () => {
    db.promotor.findMany.mockResolvedValue([{ id: 1, observacoes: "Nota", varas: [{ vara: 3 }] }]);
    const resposta = await GET(new Request("http://teste/api/promotores"));
    expect(await resposta.json()).toEqual([{ id: 1, observacoes: "Nota", varas: [3] }]);
  });
});

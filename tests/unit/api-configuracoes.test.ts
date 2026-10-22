import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir } = vi.hoisted(() => ({
  db: { escala: { findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() } },
  exigir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ EDICAO: ["CHEFE"], exigir }));

import { POST } from "../../src/app/api/configuracoes/reset/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

describe("API de configuracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
  });

  it("limpa todas as escalas em uma unica instrucao", async () => {
    db.escala.findMany.mockResolvedValue([{ id: 4 }, { id: 8 }]);
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true, apagadas: 2 });
    expect(db.escala.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [4, 8] } } });
    expect(db.escala.delete).not.toHaveBeenCalled();
  });

  it("nao chama o banco quando nao ha escala", async () => {
    db.escala.findMany.mockResolvedValue([]);
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));
    expect(await resposta.json()).toEqual({ ok: true, apagadas: 0 });
    expect(db.escala.deleteMany).not.toHaveBeenCalled();
  });

  it("rejeita a limpeza sem permissao", async () => {
    exigir.mockResolvedValue({ erro: Response.json({ erro: "Sem permissao" }, { status: 403 }) });
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));

    expect(resposta.status).toBe(403);
    expect(db.escala.findMany).not.toHaveBeenCalled();
  });
});

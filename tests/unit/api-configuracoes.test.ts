import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir } = vi.hoisted(() => ({
  db: { escala: { deleteMany: vi.fn() } },
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

  it("apaga todas as escalas em um unico deleteMany e devolve a contagem", async () => {
    db.escala.deleteMany.mockResolvedValue({ count: 2 });
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true, apagadas: 2 });
    expect(db.escala.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.escala.deleteMany).toHaveBeenCalledWith();
  });

  it("devolve zero quando o deleteMany nao apaga nenhuma escala", async () => {
    db.escala.deleteMany.mockResolvedValue({ count: 0 });
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));
    expect(await resposta.json()).toEqual({ ok: true, apagadas: 0 });
    expect(db.escala.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("rejeita a limpeza sem permissao", async () => {
    exigir.mockResolvedValue({ erro: Response.json({ erro: "Sem permissao" }, { status: 403 }) });
    const resposta = await POST(new Request("http://teste/api/configuracoes/reset", { method: "POST" }));

    expect(resposta.status).toBe(403);
    expect(db.escala.deleteMany).not.toHaveBeenCalled();
  });
});

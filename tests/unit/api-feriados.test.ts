import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir } = vi.hoisted(() => ({
  db: { feriado: { findMany: vi.fn(), upsert: vi.fn() } },
  exigir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ LEITURA: ["CHEFE", "OFICIAL"], exigir }));

import { GET, POST } from "../../src/app/api/feriados/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body?: unknown, url = "http://teste/api/feriados") {
  return new Request(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("API de feriados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
  });

  it("retorna 401 quando a leitura nao esta autenticada", async () => {
    exigir.mockResolvedValue({ erro: Response.json({ error: "Nao autenticado" }, { status: 401 }) });
    const resposta = await GET(requisicao(undefined, "http://teste/api/feriados?ano=2026"));
    expect(resposta.status).toBe(401);
    expect(db.feriado.findMany).not.toHaveBeenCalled();
  });

  it("filtra a listagem pelo ano informado", async () => {
    db.feriado.findMany.mockResolvedValue([{ id: 1, data: "2026-09-07", nome: "Feriado" }]);
    const resposta = await GET(requisicao(undefined, "http://teste/api/feriados?ano=2026"));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual([{ id: 1, data: "2026-09-07", nome: "Feriado" }]);
    expect(db.feriado.findMany).toHaveBeenCalledWith({ where: { data: { startsWith: "2026-" } }, orderBy: { data: "asc" } });
  });

  it("rejeita payload invalido e ano divergente da data", async () => {
    const invalido = await POST(requisicao({ ano: 2026, data: "2026-02-30", nome: "Carnaval" }));
    const divergente = await POST(requisicao({ ano: 2025, data: "2026-02-28", nome: "Carnaval" }));
    expect(invalido.status).toBe(400);
    expect(divergente.status).toBe(400);
    expect(db.feriado.upsert).not.toHaveBeenCalled();
  });

  it("faz upsert de feriado valido apenas para a Chefia", async () => {
    db.feriado.upsert.mockResolvedValue({ id: 1, data: "2026-02-28", nome: "Carnaval" });
    const resposta = await POST(requisicao({ ano: 2026, data: "2026-02-28", nome: " Carnaval " }));
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ id: 1, data: "2026-02-28", nome: "Carnaval" });
    expect(db.feriado.upsert).toHaveBeenCalledWith({
      where: { data: "2026-02-28" },
      update: { nome: "Carnaval" },
      create: { data: "2026-02-28", nome: "Carnaval" },
    });

    exigir.mockResolvedValue({ erro: Response.json({ error: "Sem permissao" }, { status: 403 }) });
    const proibido = await POST(requisicao({ ano: 2026, data: "2026-03-01", nome: "Teste" }));
    expect(proibido.status).toBe(403);
  });
});

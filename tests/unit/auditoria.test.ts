import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, usuarioDaRequisicao } = vi.hoisted(() => ({
  create: vi.fn(),
  usuarioDaRequisicao: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { auditoria: { create } } }));
vi.mock("@/lib/auth", () => ({ usuarioDaRequisicao }));

import { registrarAuditoria } from "../../src/lib/auditoria";
import { withApiError } from "../../src/lib/errosApi";

function requisicao(method = "POST") {
  return new Request("http://teste/api/promotores/4?segredo=nao-logar", { method, headers: { cookie: "escala_sessao=token-secreto" } });
}

describe("auditoria de API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: 1 });
    usuarioDaRequisicao.mockReturnValue({ email: "chefe@mpsp.mp.br", papel: "CHEFE" });
  });

  it("registra sucesso com contexto, acao, recurso e usuario", async () => {
    const resposta = await withApiError("promotores.id", async (_req: Request) => Response.json({ ok: true }))(requisicao("PATCH"));

    expect(resposta.status).toBe(200);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ contexto: "promotores.id", acao: "PATCH", recurso: "/api/promotores/4", usuarioEmail: "chefe@mpsp.mp.br", papel: "CHEFE", resultado: "SUCESSO", requestId: expect.any(String) }) });
  });

  it("registra falha e correlaciona o requestId com a resposta e o log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resposta = await withApiError("promotores.id", async (_req: Request) => { throw new Error("SQL secreto"); })(requisicao("DELETE"));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(500);
    expect(resposta.headers.get("x-request-id")).toBe(corpo.errorId);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ resultado: "FALHA", requestId: corpo.errorId }) });
    expect(log).toHaveBeenCalledWith("API_ERROR", expect.objectContaining({ requestId: corpo.errorId }));
  });

  it("nao registra cookie, token, senha ou segredo", async () => {
    await withApiError("login", async (_req: Request) => Response.json({ senha: "nao-logar" }))(requisicao("POST"));

    const evento = create.mock.calls[0][0].data;
    expect(JSON.stringify(evento)).not.toContain("token-secreto");
    expect(JSON.stringify(evento)).not.toContain("nao-logar");
    expect(evento).not.toHaveProperty("body");
  });

  it("nao quebra a operacao quando o registro falha", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    create.mockRejectedValue(new Error("banco indisponivel"));

    const resposta = await withApiError("promotores", async (_req: Request) => Response.json({ ok: true }))(requisicao());

    expect(resposta.status).toBe(200);
    expect(log).toHaveBeenCalledWith("AUDIT_ERROR", expect.objectContaining({ contexto: "promotores" }));
  });
});

describe("registrarAuditoria", () => {
  it("aceita requisicao sem sessao", async () => {
    usuarioDaRequisicao.mockReturnValue(null);
    await registrarAuditoria({ requestId: "req-1", contexto: "teste", acao: "POST", recurso: "/api/teste", resultado: "SUCESSO" });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ usuarioEmail: null, papel: null }) });
  });
});

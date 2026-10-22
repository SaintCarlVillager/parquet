import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, httpFormData, httpJson } from "@/lib/http";

const resposta = (status: number, body?: unknown) =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("cliente HTTP", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [400, "requisicao invalida"],
    [403, "sem permissao"],
    [409, "conflito"],
    [429, "muitas requisicoes"],
    [500, "falha interna"],
  ])("normaliza HTTP %s", async (status, error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(status, { error })));
    await expect(httpJson("/api/teste")).rejects.toMatchObject({ status, error, details: undefined });
  });

  it("normaliza detalhes e envia JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(200, { id: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(httpJson("/api/teste", { method: "POST", body: { nome: "x" } })).resolves.toEqual({ id: 1 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: '{"nome":"x"}' });
  });

  it("envia FormData sem sobrescrever o Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("arquivo", "conteudo");
    await expect(httpFormData("/api/import", form, { method: "POST" })).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: form, method: "POST" });
  });

  it("converte falha de rede em HttpError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(httpJson("/api/teste")).rejects.toMatchObject({ status: 0, error: expect.stringContaining("conectar") });
  });

  it("redireciona no 401 e preserva a mensagem segura", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/escala", assign }, sessionStorage: { setItem: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(401, { erro: "Sessao expirada" })));
    await expect(httpJson("/api/teste")).rejects.toBeInstanceOf(HttpError);
    expect(assign).toHaveBeenCalledWith("/login");
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("escala_http_erro", "Sessao expirada");
  });
});

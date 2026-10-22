import { afterEach, describe, expect, it, vi } from "vitest";
import { codigoPrisma, erroInterno, withApiError } from "../../src/lib/errosApi";

describe("erros de API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gera resposta segura e registra o errorId", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resposta = erroInterno("teste", new Error("SQL secreto"));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(500);
    expect(corpo.erro).toBe("Erro interno do servidor");
    expect(corpo.errorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(corpo)).not.toContain("SQL secreto");
    expect(log).toHaveBeenCalledWith("API_ERROR", expect.objectContaining({ errorId: corpo.errorId, contexto: "teste" }));
  });

  it("identifica codigo Prisma sem depender da classe do erro", () => {
    expect(codigoPrisma({ code: "P2025" })).toBe("P2025");
    expect(codigoPrisma(new Error("falha"))).toBeNull();
    expect(codigoPrisma(null)).toBeNull();
  });

  it("converte excecao fora do try interno em erro seguro com errorId", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resposta = await withApiError("rota.teste", async () => {
      throw new Error("SQL secreto fora do try interno");
    })();
    const corpo = await resposta.json();

    expect(resposta.status).toBe(500);
    expect(corpo).toEqual({ erro: "Erro interno do servidor", errorId: expect.any(String) });
    expect(JSON.stringify(corpo)).not.toContain("SQL secreto");
    expect(log).toHaveBeenCalledWith("API_ERROR", expect.objectContaining({ contexto: "rota.teste", errorId: corpo.errorId }));
  });
});

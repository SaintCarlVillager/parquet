import { describe, expect, it } from "vitest";
import { conferirSenha, criarToken, EDICAO, EDICAO_TROCAS, LEITURA, lerToken, TODOS } from "../../src/lib/auth";

const sessao = {
  email: "teste@mpsp.mp.br",
  papel: "CHEFE" as const,
  nome: "Teste",
  sessaoVersao: 1,
};

describe("autenticacao criptografica", () => {
  it("gera hash de senha que confere apenas com a senha original", async () => {
    const { hashSenha } = await import("../../src/lib/auth");
    const hash = hashSenha("senha-segura");
    expect(hash).not.toBe("senha-segura");
    expect(conferirSenha("senha-segura", hash)).toBe(true);
    expect(conferirSenha("outra-senha", hash)).toBe(false);
  });

  it("cria e valida token assinado", () => {
    const token = criarToken(sessao);
    expect(lerToken(token)).toMatchObject(sessao);
    expect(lerToken(`${token}x`)).toBeNull();
    expect(lerToken(undefined)).toBeNull();
  });

  it("expoe as matrizes de permissao", () => {
    expect(EDICAO).toEqual(["CHEFE"]);
    expect(LEITURA).toEqual(["CHEFE", "OFICIAL"]);
    expect(EDICAO_TROCAS).toEqual(["CHEFE", "OFICIAL"]);
    expect(TODOS).toEqual(["CHEFE", "OFICIAL", "PROMOTOR"]);
  });
});

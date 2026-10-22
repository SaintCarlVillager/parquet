import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("../../src/lib/db", () => ({
  db: { usuarioPapel: { findUnique } },
}));

import { criarToken, EDICAO, EDICAO_TROCAS, exigir, LEITURA } from "../../src/lib/auth";

function requisicao(papel: "CHEFE" | "OFICIAL" | "PROMOTOR") {
  const token = criarToken({ email: `${papel.toLowerCase()}@teste`, papel, nome: papel, sessaoVersao: 1 });
  return new Request("http://teste", { headers: { cookie: `escala_sessao=${token}` } });
}

describe("autorizacao por papel", () => {
  beforeEach(() => {
    findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => {
      const papel = where.email.split("@")[0].toUpperCase();
      return { email: where.email, nome: papel, papel, senhaHash: "hash", sessaoVersao: 1 };
    });
  });

  it("nega requisicao sem sessao", async () => {
    const resultado = await exigir(new Request("http://teste"), LEITURA);
    expect("erro" in resultado && resultado.erro.status).toBe(401);
  });

  it("permite leitura para oficial e promotor conforme a matriz", async () => {
    const oficial = await exigir(requisicao("OFICIAL"), LEITURA);
    const promotor = await exigir(requisicao("PROMOTOR"), ["PROMOTOR"]);
    expect("erro" in oficial).toBe(false);
    expect("erro" in promotor).toBe(false);
  });

  it("impede edicao por oficial e promotor", async () => {
    const oficial = await exigir(requisicao("OFICIAL"), EDICAO);
    const promotor = await exigir(requisicao("PROMOTOR"), EDICAO_TROCAS);
    expect("erro" in oficial && oficial.erro.status).toBe(403);
    expect("erro" in promotor && promotor.erro.status).toBe(403);
  });

  it("permite ao chefe editar e lancar trocas", async () => {
    const edicao = await exigir(requisicao("CHEFE"), EDICAO);
    const trocas = await exigir(requisicao("CHEFE"), EDICAO_TROCAS);
    expect("erro" in edicao).toBe(false);
    expect("erro" in trocas).toBe(false);
  });
});

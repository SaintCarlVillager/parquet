import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, conferirSenha, hashSenha, exigir } = vi.hoisted(() => ({
  db: { usuarioPapel: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() } },
  conferirSenha: vi.fn(),
  hashSenha: vi.fn(() => "hash-nova"),
  exigir: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({
  EDICAO: ["CHEFE"],
  LEITURA: ["CHEFE", "OFICIAL"],
  TODOS: ["CHEFE", "OFICIAL", "PROMOTOR"],
  exigir,
  hashSenha,
  conferirSenha,
  NOME_COOKIE: "escala_sessao",
  MAX_AGE_S: 604800,
  OPCOES_COOKIE: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 604800 },
  criarToken: vi.fn(() => "token-novo"),
}));

import { PUT as atualizarUsuario } from "../../src/app/api/usuarios/route";
import { POST as trocarSenha } from "../../src/app/api/trocar-senha/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body: unknown, path = "/api/usuarios") {
  return new Request(`http://teste${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("politica minima de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
    conferirSenha.mockReturnValue(true);
    db.usuarioPapel.findFirst.mockResolvedValue(null);
    db.usuarioPapel.upsert.mockResolvedValue({ email: "x@teste", nome: "X", papel: "OFICIAL", oficialEmail: null });
  });

  it("recusa cadastro de usuario com senha curta", async () => {
    const resposta = await atualizarUsuario(requisicao({ email: "x@teste", papel: "OFICIAL", senha: "curta" }));
    expect(resposta.status).toBe(400);
    expect(db.usuarioPapel.upsert).not.toHaveBeenCalled();
  });

  it("aceita cadastro de usuario com senha de 8 caracteres ou mais", async () => {
    const resposta = await atualizarUsuario(requisicao({ email: "x@teste", papel: "OFICIAL", senha: "senha-forte-1" }));
    expect(resposta.status).toBe(200);
    expect(db.usuarioPapel.upsert).toHaveBeenCalled();
  });

  it("recusa troca de senha com senha nova curta antes de consultar o banco", async () => {
    const resposta = await trocarSenha(requisicao({ atual: "senha-antiga", nova: "curta" }, "/api/trocar-senha"));
    expect(resposta.status).toBe(400);
    expect(db.usuarioPapel.findUnique).not.toHaveBeenCalled();
  });

  it("aceita troca de senha valida e mantem a sessao ativa com token novo", async () => {
    db.usuarioPapel.findUnique.mockResolvedValue({ email: chefe.email, senhaHash: "hash-atual" });
    db.usuarioPapel.update = vi.fn().mockResolvedValue({ sessaoVersao: 2 });
    const resposta = await trocarSenha(requisicao({ atual: "senha-antiga", nova: "senha-nova-1" }, "/api/trocar-senha"));
    expect(resposta.status).toBe(200);
    expect(db.usuarioPapel.update).toHaveBeenCalledWith({
      where: { email: chefe.email },
      data: { senhaHash: "hash-nova", sessaoVersao: { increment: 1 } },
      select: { sessaoVersao: true },
    });
    const cookie = resposta.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("escala_sessao=token-novo");
    expect(cookie).toContain("HttpOnly");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, exigir, hashSenha, conferirSenha, substituirGrade } = vi.hoisted(() => ({
  db: {
    usuarioPapel: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    gradeExcecao: { upsert: vi.fn() },
    escala: { findUnique: vi.fn() },
    designacao: { deleteMany: vi.fn() },
    posicao: { findMany: vi.fn() },
    gradeItem: { findMany: vi.fn() },
    grupoCarga: { findMany: vi.fn() },
    cargoAdministrativo: { findMany: vi.fn(), upsert: vi.fn() },
    promotor: { findUnique: vi.fn() },
  },
  exigir: vi.fn(),
  hashSenha: vi.fn(() => "hash-nova"),
  conferirSenha: vi.fn(),
  substituirGrade: vi.fn(),
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
vi.mock("@/lib/escritasAtomicas", () => ({ substituirGrade }));

import { PUT as atualizarUsuario, DELETE as excluirUsuario } from "../../src/app/api/usuarios/route";
import { POST as trocarSenha } from "../../src/app/api/trocar-senha/route";
import { POST as salvarExcecao } from "../../src/app/api/excecoes/route";
import { PUT as salvarGrade } from "../../src/app/api/grade/route";
import { PUT as salvarCargos } from "../../src/app/api/cargos/route";

const chefe = { email: "chefe@teste", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 1, exp: 0 };

function requisicao(body: unknown, path = "/api/admin") {
  return new Request(`http://teste${path}`, { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("APIs administrativas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigir.mockResolvedValue(chefe);
    conferirSenha.mockReturnValue(true);
  });

  it("impede usuario com papel invalido e vinculo para oficial inexistente", async () => {
    expect((await atualizarUsuario(requisicao({ email: "x@teste", papel: "INVALIDO" }))).status).toBe(400);
    db.usuarioPapel.findFirst.mockResolvedValue(null);
    const resposta = await atualizarUsuario(requisicao({ email: "x@teste", papel: "PROMOTOR", oficialEmail: "oficial@teste" }));
    expect(resposta.status).toBe(400);
    expect(db.usuarioPapel.upsert).not.toHaveBeenCalled();
  });

  it("nao permite remover a propria conta", async () => {
    const resposta = await excluirUsuario(new Request("http://teste/api/usuarios?email=chefe@teste", { method: "DELETE" }));
    expect(resposta.status).toBe(400);
    expect(db.usuarioPapel.delete).not.toHaveBeenCalled();
  });

  it("normaliza e-mail e retorna 404 para usuario inexistente", async () => {
    db.usuarioPapel.delete.mockRejectedValue({ code: "P2025" });
    const resposta = await excluirUsuario(new Request("http://teste/api/usuarios?email=%20OUTRO@TESTE.COM%20", { method: "DELETE" }));
    expect(resposta.status).toBe(404);
    expect(db.usuarioPapel.delete).toHaveBeenCalledWith({ where: { email: "outro@teste.com" } });
  });

  it("troca senha somente com senha atual correta e tamanho valido", async () => {
    expect((await trocarSenha(requisicao({ atual: "123", nova: "123" }, "/api/trocar-senha"))).status).toBe(400);
    db.usuarioPapel.findUnique.mockResolvedValue({ email: chefe.email, senhaHash: "hash-atual" });
    conferirSenha.mockReturnValue(false);
    expect((await trocarSenha(requisicao({ atual: "antiga", nova: "nova1234" }, "/api/trocar-senha"))).status).toBe(401);

    conferirSenha.mockReturnValue(true);
    db.usuarioPapel.update.mockResolvedValue({ sessaoVersao: 2 });
    const resposta = await trocarSenha(requisicao({ atual: "antiga", nova: "nova1234" }, "/api/trocar-senha"));
    expect(resposta.status).toBe(200);
    expect(db.usuarioPapel.update).toHaveBeenCalledWith({
      where: { email: chefe.email },
      data: { senhaHash: "hash-nova", sessaoVersao: { increment: 1 } },
      select: { sessaoVersao: true },
    });
  });

  it("faz upsert de excecao somente com payload completo", async () => {
    expect((await salvarExcecao(requisicao({ data: "2026-09-10", posicaoId: 1 }, "/api/excecoes"))).status).toBe(400);
    db.gradeExcecao.upsert.mockResolvedValue({ id: 3, ativa: false });
    const resposta = await salvarExcecao(requisicao({ data: "2026-09-10", posicaoId: 1, ativa: false, motivo: "recesso" }, "/api/excecoes"));
    expect(resposta.status).toBe(201);
    expect(db.gradeExcecao.upsert).toHaveBeenCalled();
  });

  it("ao desligar posicao apaga a designacao do dia e recusa escala publicada", async () => {
    db.escala.findUnique.mockResolvedValue({ id: 8, status: "PUBLICADA" });
    const publicada = await salvarExcecao(requisicao({ data: "2026-10-27", posicaoId: 3, ativa: false, motivo: "Desativada na tela da escala" }, "/api/excecoes"));
    expect(publicada.status).toBe(409);
    expect(db.designacao.deleteMany).not.toHaveBeenCalled();
    expect(db.gradeExcecao.upsert).not.toHaveBeenCalled();

    db.escala.findUnique.mockResolvedValue({ id: 8, status: "RASCUNHO" });
    db.gradeExcecao.upsert.mockResolvedValue({ id: 4, data: "2026-10-27", posicaoId: 3, ativa: false });
    const desligada = await salvarExcecao(requisicao({ data: "2026-10-27", posicaoId: 3, ativa: false, motivo: "Desativada na tela da escala" }, "/api/excecoes"));
    expect(desligada.status).toBe(201);
    expect(db.designacao.deleteMany).toHaveBeenCalledWith({ where: { escalaId: 8, data: "2026-10-27", posicaoId: 3 } });

    db.designacao.deleteMany.mockClear();
    db.gradeExcecao.upsert.mockResolvedValue({ id: 5, data: "2026-10-27", posicaoId: 3, ativa: true });
    const ligada = await salvarExcecao(requisicao({ data: "2026-10-27", posicaoId: 3, ativa: true, motivo: "Ativada na tela da escala" }, "/api/excecoes"));
    expect(ligada.status).toBe(201);
    expect(db.designacao.deleteMany).not.toHaveBeenCalled();
  });

  it("rejeita corpo malformado na grade com 400", async () => {
    const invalida = new Request("http://teste/api/grade", { method: "PUT", body: "{", headers: { "content-type": "application/json" } });
    expect((await salvarGrade(invalida)).status).toBe(400);
    expect(substituirGrade).not.toHaveBeenCalled();
  });

  it("valida pesos da grade e remove itens duplicados antes da escrita", async () => {
    expect((await salvarGrade(requisicao({ grupos: [{ grupo: "AUDIENCIAS", peso: -1 }], gradeItens: [] }, "/api/grade"))).status).toBe(400);
    db.posicao.findMany.mockResolvedValue([{ id: 10 }]);
    db.grupoCarga.findMany.mockResolvedValue([{ grupo: "AUDIENCIAS" }]);
    const resposta = await salvarGrade(requisicao({ grupos: [{ grupo: "AUDIENCIAS", peso: 1 }], gradeItens: [{ diaSemana: 1, posicaoId: 10 }, { diaSemana: 1, posicaoId: 10 }] }, "/api/grade"));
    expect(resposta.status).toBe(200);
    expect(substituirGrade).toHaveBeenCalledWith([{ grupo: "AUDIENCIAS", peso: 1 }], [{ diaSemana: 1, posicaoId: 10 }]);
  });

  it("rejeita o mesmo promotor nos dois cargos administrativos", async () => {
    const resposta = await salvarCargos(requisicao({ SECRETARIO: 4, SUBSECRETARIO: 4 }, "/api/cargos"));
    expect(resposta.status).toBe(400);
    expect(db.cargoAdministrativo.upsert).not.toHaveBeenCalled();
  });
});

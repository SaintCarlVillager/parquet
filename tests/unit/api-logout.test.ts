import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    $executeRaw: vi.fn(),
    usuarioPapel: { updateMany: vi.fn() },
    auditoria: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import { criarToken } from "../../src/lib/auth";
import { POST } from "../../src/app/api/logout/route";

const sessao = { email: "chefe@mpsp.mp.br", papel: "CHEFE" as const, nome: "Chefe", sessaoVersao: 3 };

function requisicao(cookie?: string) {
  return new Request("http://teste/api/logout", { method: "POST", headers: cookie ? { cookie: `escala_sessao=${cookie}` } : {} });
}

function cookieLimpo(resposta: Response) {
  const setCookie = resposta.headers.get("set-cookie") ?? "";
  return setCookie.startsWith("escala_sessao=;") && /Max-Age=0/i.test(setCookie);
}

describe("API de logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$executeRaw.mockResolvedValue(1);
    db.auditoria.create.mockResolvedValue({ id: 1 });
  });

  it("invalida no servidor a versao de sessao do token atual e limpa o cookie", async () => {
    const resposta = await POST(requisicao(criarToken(sessao)));
    expect(resposta.status).toBe(200);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const [partes, email, versao] = db.$executeRaw.mock.calls[0];
    expect(partes.join("?").replace(/\s+/g, " ").trim()).toBe(
      'UPDATE "UsuarioPapel" SET "sessaoVersao" = "sessaoVersao" + 1 WHERE "email" = ? AND "sessaoVersao" = ?',
    );
    expect([email, versao]).toEqual(["chefe@mpsp.mp.br", 3]);
    expect(db.usuarioPapel.updateMany).not.toHaveBeenCalled();
    expect(cookieLimpo(resposta)).toBe(true);
  });

  it("nao toca o banco sem cookie, mas responde ok e limpa o cookie", async () => {
    const resposta = await POST(requisicao());
    expect(resposta.status).toBe(200);
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(cookieLimpo(resposta)).toBe(true);
  });

  it("ignora token com assinatura invalida", async () => {
    const resposta = await POST(requisicao(`${criarToken(sessao)}x`));
    expect(resposta.status).toBe(200);
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(cookieLimpo(resposta)).toBe(true);
  });

  it("token antigo nao derruba sessoes mais novas", async () => {
    db.$executeRaw.mockResolvedValue(0);
    const resposta = await POST(requisicao(criarToken({ ...sessao, sessaoVersao: 1 })));
    expect(resposta.status).toBe(200);
    expect(db.$executeRaw.mock.calls[0].slice(1)).toEqual(["chefe@mpsp.mp.br", 1]);
    expect(cookieLimpo(resposta)).toBe(true);
  });

  it("falha do banco devolve 500 com errorId, sem expor detalhe, e ainda limpa o cookie", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.$executeRaw.mockRejectedValue(new Error("SQL secreto"));
    const resposta = await POST(requisicao(criarToken(sessao)));
    expect(resposta.status).toBe(500);
    const corpo = await resposta.json();
    expect(corpo.errorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(corpo)).not.toContain("SQL secreto");
    expect(cookieLimpo(resposta)).toBe(true);
    expect(db.auditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestId: corpo.errorId, contexto: "logout.POST", resultado: "FALHA" }),
    });
    log.mockRestore();
  });
});

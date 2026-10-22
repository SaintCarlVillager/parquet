import { beforeEach, describe, expect, it, vi } from "vitest";

const { autenticar, criarToken, verificarLimite, registrarFalha, limparFalhas } = vi.hoisted(() => ({
  autenticar: vi.fn(),
  criarToken: vi.fn(() => "token-teste"),
  verificarLimite: vi.fn(),
  registrarFalha: vi.fn(),
  limparFalhas: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  NOME_COOKIE: "escala_sessao",
  MAX_AGE_S: 604800,
  OPCOES_COOKIE: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 604800 },
  autenticar,
  criarToken,
}));
vi.mock("@/lib/loginRateLimit", () => ({ chavesLogin: vi.fn((email: string) => [`email:${email}`]), verificarLimite, registrarFalha, limparFalhas }));

import { POST } from "../../src/app/api/login/route";

function requisicao(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://teste/api/login", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

describe("API de login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificarLimite.mockResolvedValue({ bloqueado: false, retryAfter: 0 });
    autenticar.mockResolvedValue({ email: "user@mpsp.mp.br", nome: "User", papel: "CHEFE", sessaoVersao: 1, exp: 0 });
  });

  it("rejeita corpo ausente ou incompleto", async () => {
    const resposta = await POST(requisicao({ email: "user@mpsp.mp.br" }));
    expect(resposta.status).toBe(400);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it("aplica limite de tamanho antes de ler as credenciais", async () => {
    const resposta = await POST(requisicao({ email: "user@mpsp.mp.br", senha: "senha" }, { "content-length": "9000" }));
    expect(resposta.status).toBe(413);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it("retorna 429 e Retry-After quando o cliente esta bloqueado", async () => {
    verificarLimite.mockResolvedValue({ bloqueado: true, retryAfter: 42 });
    const resposta = await POST(requisicao({ email: "user@mpsp.mp.br", senha: "senha" }));
    expect(resposta.status).toBe(429);
    expect(resposta.headers.get("retry-after")).toBe("42");
    expect(autenticar).not.toHaveBeenCalled();
  });

  it("registra falha para credenciais invalidas", async () => {
    autenticar.mockResolvedValue(null);
    const resposta = await POST(requisicao({ email: " USER@MPSP.MP.BR ", senha: "errada" }));
    expect(resposta.status).toBe(401);
    expect(registrarFalha).toHaveBeenCalledWith(["email:user@mpsp.mp.br"]);
    expect(limparFalhas).not.toHaveBeenCalled();
  });

  it("cria cookie de sessao para credenciais validas", async () => {
    const resposta = await POST(requisicao({ email: " USER@MPSP.MP.BR ", senha: "correta" }));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ email: "user@mpsp.mp.br", papel: "CHEFE" });
    expect(criarToken).toHaveBeenCalledWith({ email: "user@mpsp.mp.br", papel: "CHEFE", nome: "User", sessaoVersao: 1 });
    expect(resposta.headers.get("set-cookie")).toContain("escala_sessao=token-teste");
    expect(limparFalhas).toHaveBeenCalledWith(["email:user@mpsp.mp.br"]);
  });
});

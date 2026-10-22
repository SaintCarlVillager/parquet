import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: { loginTentativa: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db }));

import { registrarFalha, verificarLimite } from "../../src/lib/loginRateLimit";

describe("limite de tentativas de login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.loginTentativa.findUnique.mockResolvedValue(null);
    db.loginTentativa.upsert.mockResolvedValue({});
    db.loginTentativa.deleteMany.mockResolvedValue({ count: 3 });
  });

  it("nao bloqueia quem nao tem falhas registradas", async () => {
    const r = await verificarLimite(["email:abc"]);
    expect(r).toEqual({ bloqueado: false, retryAfter: 0 });
    expect(db.loginTentativa.deleteMany).not.toHaveBeenCalled();
  });

  it("bloqueia enquanto o horario de liberacao nao passou", async () => {
    db.loginTentativa.findUnique.mockResolvedValue({ bloqueadoAte: new Date(Date.now() + 60000) });
    const r = await verificarLimite(["email:abc"]);
    expect(r.bloqueado).toBe(true);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("remove registros antigos ao registrar falha", async () => {
    await registrarFalha(["email:abc", "ip:xyz"]);
    expect(db.loginTentativa.deleteMany).toHaveBeenCalledTimes(1);
    const filtro = db.loginTentativa.deleteMany.mock.calls[0][0] as { where: { atualizadoEm: { lt: Date } } };
    const idade = Date.now() - filtro.where.atualizadoEm.lt.getTime();
    expect(idade).toBeGreaterThanOrEqual(60 * 60 * 1000);
    expect(db.loginTentativa.upsert).toHaveBeenCalledTimes(2);
  });

  it("limpa as chaves quando o login da certo", async () => {
    const { limparFalhas } = await import("../../src/lib/loginRateLimit");
    await limparFalhas(["email:abc"]);
    expect(db.loginTentativa.deleteMany).toHaveBeenCalledWith({ where: { chave: { in: ["email:abc"] } } });
  });
});

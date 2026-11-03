import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { usuarioPapel: { findUnique } } }));
vi.mock("../../src/lib/db", () => ({ db: { usuarioPapel: { findUnique } } }));

import crypto from "node:crypto";
import { autenticar, hashSenha } from "../../src/lib/auth";

describe("autenticar resiste a enumeracao de usuarios por tempo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    findUnique.mockReset();
  });

  it("executa scrypt mesmo quando o e-mail nao existe", async () => {
    findUnique.mockResolvedValue(null);
    const spy = vi.spyOn(crypto, "scryptSync");
    expect(await autenticar("inexistente@mpsp.mp.br", "qualquer-senha")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("executa scrypt quando o usuario existe sem senha cadastrada", async () => {
    findUnique.mockResolvedValue({ email: "a@mpsp.mp.br", papel: "CHEFE", senhaHash: null, sessaoVersao: 0 });
    const spy = vi.spyOn(crypto, "scryptSync");
    expect(await autenticar("a@mpsp.mp.br", "qualquer-senha")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("autentica normalmente com a senha correta", async () => {
    findUnique.mockResolvedValue({ email: "a@mpsp.mp.br", nome: "A", papel: "CHEFE", senhaHash: hashSenha("senha-correta"), sessaoVersao: 2 });
    expect(await autenticar("A@mpsp.mp.br ", "senha-correta")).toMatchObject({ email: "a@mpsp.mp.br", papel: "CHEFE", sessaoVersao: 2 });
    expect(await autenticar("a@mpsp.mp.br", "senha-errada")).toBeNull();
  });
});

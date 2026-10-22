import { describe, expect, it } from "vitest";
import { conteudoSuspeito, eArquivoDeTeste, nomeProibido, verificarArquivo } from "../../scripts/higiene.mjs";

describe("nomeProibido", () => {
  it("detecta arquivos de ambiente", () => {
    expect(nomeProibido(".env")).not.toBeNull();
    expect(nomeProibido(".env.production.local")).not.toBeNull();
    expect(nomeProibido("config/.env.development")).not.toBeNull();
  });

  it("permite .env.example", () => {
    expect(nomeProibido(".env.example")).toBeNull();
  });

  it("detecta artefatos temporarios de exportacao", () => {
    expect(nomeProibido("tmp-export.xlsx")).not.toBeNull();
    expect(nomeProibido("tmp-custodia-afastado.xlsx")).not.toBeNull();
  });

  it("detecta chaves e credenciais", () => {
    expect(nomeProibido("id_rsa")).not.toBeNull();
    expect(nomeProibido("servidor.pem")).not.toBeNull();
    expect(nomeProibido("credentials")).not.toBeNull();
    expect(nomeProibido("secrets.json")).not.toBeNull();
  });

  it("nao reclama de arquivos comuns", () => {
    expect(nomeProibido("src/foo.ts")).toBeNull();
    expect(nomeProibido("README.md")).toBeNull();
  });
});

describe("conteudoSuspeito", () => {
  it("detecta chave privada", () => {
    expect(conteudoSuspeito("-----BEGIN RSA PRIVATE KEY-----\nAAA\n-----END RSA PRIVATE KEY-----")).toContain("chave privada");
  });

  it("detecta chave AWS", () => {
    expect(conteudoSuspeito("token AKIAIOSFODNN7EXAMPLE resto")).toContain("chave AWS");
  });

  it("detecta senha Neon", () => {
    expect(conteudoSuspeito("postgresql://user:npg_abcdef1234@host")).toContain("senha Neon");
  });

  it("detecta URL de banco remota com senha", () => {
    expect(conteudoSuspeito("postgresql://owner:senha123@ep-foo.neon.tech/db")).toContain("URL de banco remota com senha");
  });

  it("nao detecta URL de banco local de teste", () => {
    expect(conteudoSuspeito("postgresql://teste:teste@localhost:5432/teste")).toEqual([]);
  });

  it("nao detecta conteudo limpo", () => {
    expect(conteudoSuspeito("const a = 1; // comentario")).toEqual([]);
  });
});

describe("eArquivoDeTeste", () => {
  it("reconhece arquivos sob tests/ e fixtures", () => {
    expect(eArquivoDeTeste("tests/unit/higiene.test.ts")).toBe(true);
    expect(eArquivoDeTeste("tests/components/x.test.tsx")).toBe(true);
    expect(eArquivoDeTeste("fixtures/dados.json")).toBe(true);
  });

  it("nao trata fonte comum como arquivo de teste", () => {
    expect(eArquivoDeTeste("src/lib/gerador.ts")).toBe(false);
    expect(eArquivoDeTeste("scripts/valida.mjs")).toBe(false);
  });
});

describe("verificarArquivo", () => {
  it("lista problemas para arquivo proibido com segredo", () => {
    const problemas = verificarArquivo(".env", "DATABASE_URL=postgresql://u:npg_xxx@ep-foo.neon.tech/db");
    expect(problemas.length).toBeGreaterThan(0);
  });

  it("retorna lista vazia para arquivo limpo", () => {
    expect(verificarArquivo("src/ok.ts", "export const x = 1;")).toEqual([]);
  });
});

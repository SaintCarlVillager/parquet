import { describe, expect, it } from "vitest";
import { origemPermitida } from "../../src/lib/origem";

function req(method: string, headers: Record<string, string>) {
  return new Request("https://app.exemplo/api/escalas", { method, headers });
}

describe("bloqueio de requisicoes entre origens", () => {
  it("permite leitura independente da origem", () => {
    expect(origemPermitida(req("GET", { host: "app.exemplo", origin: "https://malicioso.exemplo" }))).toBe(true);
    expect(origemPermitida(req("HEAD", { host: "app.exemplo", "sec-fetch-site": "cross-site" }))).toBe(true);
  });

  it("permite mutacao da mesma origem", () => {
    expect(origemPermitida(req("POST", { host: "app.exemplo", origin: "https://app.exemplo" }))).toBe(true);
    expect(origemPermitida(req("DELETE", { host: "app.exemplo", origin: "https://app.exemplo", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(origemPermitida(req("PUT", { "x-forwarded-host": "app.exemplo", host: "interno", origin: "https://app.exemplo" }))).toBe(true);
  });

  it("permite clientes sem cabecalhos de navegador (scripts e testes E2E)", () => {
    expect(origemPermitida(req("POST", { host: "app.exemplo" }))).toBe(true);
  });

  it("bloqueia mutacao de outra origem", () => {
    expect(origemPermitida(req("POST", { host: "app.exemplo", origin: "https://malicioso.exemplo" }))).toBe(false);
    expect(origemPermitida(req("PATCH", { host: "app.exemplo", origin: "https://app.exemplo.malicioso.exemplo" }))).toBe(false);
    expect(origemPermitida(req("POST", { host: "app.exemplo", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(origemPermitida(req("POST", { host: "app.exemplo", "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("bloqueia origem opaca ou invalida", () => {
    expect(origemPermitida(req("POST", { host: "app.exemplo", origin: "null" }))).toBe(false);
    expect(origemPermitida(req("POST", { host: "app.exemplo", origin: "nao-e-url" }))).toBe(false);
    expect(origemPermitida(req("POST", { origin: "https://app.exemplo" }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { dataISO, inteiroPositivo, lerObjeto, numeroFinito, objeto, texto, textoOpcional } from "../../src/lib/validacao";

describe("validacao de entradas", () => {
  it("aceita inteiros positivos e rejeita zero, negativos e fracionarios", () => {
    expect(inteiroPositivo(3)).toBe(3);
    expect(inteiroPositivo("12")).toBe(12);
    expect(inteiroPositivo(0)).toBeNull();
    expect(inteiroPositivo("1.5")).toBeNull();
    expect(inteiroPositivo(-1)).toBeNull();
    expect(inteiroPositivo(2147483648)).toBeNull();
    expect(inteiroPositivo(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it("aceita numeros finitos, inclusive strings numericas", () => {
    expect(numeroFinito("2.5")).toBe(2.5);
    expect(numeroFinito(0)).toBe(0);
    expect(numeroFinito("   ")).toBeNull();
    expect(numeroFinito("abc")).toBeNull();
  });

  it("normaliza textos e aplica obrigatoriedade e limite", () => {
    expect(texto("  abc  ", 3)).toBe("abc");
    expect(texto("", 3, true)).toBeNull();
    expect(texto("abcd", 3)).toBeNull();
    expect(texto(12, 3)).toBe("");
    expect(textoOpcional(undefined, 3)).toBeNull();
    expect(textoOpcional(null, 3)).toBeNull();
    expect(textoOpcional(" abc ", 3)).toBe("abc");
    expect(textoOpcional(12, 3)).toBeNull();
  });

  it("valida datas ISO reais, nao apenas o formato", () => {
    expect(dataISO("2026-02-28")).toBe("2026-02-28");
    expect(dataISO("2026-02-29")).toBeNull();
    expect(dataISO("2026-2-01")).toBeNull();
  });

  it("distingue objetos de arrays e nulos", async () => {
    expect(objeto({ a: 1 })).toEqual({ a: 1 });
    expect(objeto([])).toBeNull();
    expect(objeto(null)).toBeNull();
    expect(await lerObjeto(new Request("http://teste", { method: "POST", body: JSON.stringify({ a: 1 }) }))).toEqual({ a: 1 });
    expect(await lerObjeto(new Request("http://teste", { method: "POST", body: "invalido" }))).toBeNull();
  });
});

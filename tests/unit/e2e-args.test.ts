import { describe, expect, it } from "vitest";
import { extrairGrupo, selecionarScripts } from "../../scripts/e2e-args.mjs";

const grupos = {
  gerador: ["valida-ajustes.mjs", "valida-varas.mjs"],
  regras: ["valida-regras.mjs"],
};

describe("argumentos do runner E2E", () => {
  it("nao trata a ausencia de --group como grupo valido", () => {
    expect(extrairGrupo(["node", "roda-e2e.mjs"], grupos)).toBeNull();
    expect(extrairGrupo(["C:/tools/nodejs/node.exe", "roda-e2e.mjs"], grupos)).toBeNull();
  });

  it("extrai o grupo informado", () => {
    expect(extrairGrupo(["node", "roda-e2e.mjs", "--group", "regras"], grupos)).toBe("regras");
  });

  it("rejeita grupo inexistente e --group sem valor", () => {
    expect(() => extrairGrupo(["node", "roda-e2e.mjs", "--group", "inexistente"], grupos)).toThrow("Grupo E2E nao encontrado");
    expect(() => extrairGrupo(["node", "roda-e2e.mjs", "--group"], grupos)).toThrow("--group exige");
    expect(() => extrairGrupo(["node", "roda-e2e.mjs", "--group", "--outro"], grupos)).toThrow("--group exige");
  });
});

describe("selecao de validadores", () => {
  const scripts = ["valida-ajustes.mjs", "valida-regras.mjs", "valida-varas.mjs"];

  it("roda todos os validadores sem grupo", () => {
    expect(selecionarScripts(scripts, grupos, null, undefined)).toEqual(scripts);
  });

  it("filtra pelo grupo preservando a ordem de execucao", () => {
    expect(selecionarScripts(scripts, grupos, "gerador", undefined)).toEqual(["valida-ajustes.mjs", "valida-varas.mjs"]);
  });

  it("retoma a partir do validador informado", () => {
    expect(selecionarScripts(scripts, grupos, null, "valida-regras.mjs")).toEqual(["valida-regras.mjs", "valida-varas.mjs"]);
    expect(() => selecionarScripts(scripts, grupos, null, "valida-inexistente.mjs")).toThrow("Validador nao encontrado");
  });
});

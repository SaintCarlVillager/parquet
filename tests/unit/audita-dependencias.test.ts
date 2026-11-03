import { describe, expect, it } from "vitest";
import { avaliarAuditoria, validarExcecoes } from "../../scripts/audita-dependencias.mjs";

const advisory = (id: string, nome = "minimatch", severidade = "moderate") => ({
  source: 1,
  name: nome,
  title: `falha em ${nome}`,
  url: `https://github.com/advisories/${id}`,
  severity: severidade,
  range: "<11.0.1",
});

const relatorio = (...advisories: ReturnType<typeof advisory>[]) => ({
  vulnerabilities: {
    ...Object.fromEntries(advisories.map((a) => [a.name, { name: a.name, severity: a.severity, via: [a] }])),
    exceljs: { name: "exceljs", severity: "moderate", via: ["archiver"] },
  },
});

const excecao = { id: "GHSA-g3hv-75wg-m249", pacote: "minimatch", motivo: "sem padrao controlado pelo usuario", expira: "2027-01-02" };

describe("auditoria de dependencias com excecoes", () => {
  it("passa sem vulnerabilidades", () => {
    expect(avaliarAuditoria({ vulnerabilities: {} }, [], "2026-11-03")).toEqual({ bloqueantes: [], ignoradas: [], semUso: [] });
  });

  it("bloqueia advisory sem excecao", () => {
    const r = avaliarAuditoria(relatorio(advisory("GHSA-aaaa-bbbb-cccc", "outro")), [], "2026-11-03");
    expect(r.bloqueantes).toEqual([expect.objectContaining({ id: "GHSA-aaaa-bbbb-cccc", pacote: "outro" })]);
  });

  it("ignora advisory com excecao vigente e ignora entradas transitivas", () => {
    const r = avaliarAuditoria(relatorio(advisory("GHSA-g3hv-75wg-m249")), [excecao], "2026-11-03");
    expect(r.bloqueantes).toEqual([]);
    expect(r.ignoradas).toEqual([expect.objectContaining({ id: "GHSA-g3hv-75wg-m249", expira: "2027-01-02" })]);
  });

  it("aceita a excecao ate o dia da expiracao e bloqueia depois", () => {
    expect(avaliarAuditoria(relatorio(advisory("GHSA-g3hv-75wg-m249")), [excecao], "2027-01-02").bloqueantes).toEqual([]);
    const vencida = avaliarAuditoria(relatorio(advisory("GHSA-g3hv-75wg-m249")), [excecao], "2027-01-03");
    expect(vencida.bloqueantes).toEqual([expect.objectContaining({ id: "GHSA-g3hv-75wg-m249", motivo: expect.stringContaining("expirou") })]);
  });

  it("nao deixa a excecao de um advisory cobrir outro", () => {
    const r = avaliarAuditoria(relatorio(advisory("GHSA-g3hv-75wg-m249"), advisory("GHSA-zzzz-yyyy-xxxx", "zip-stream", "high")), [excecao], "2026-11-03");
    expect(r.bloqueantes.map((b) => b.id)).toEqual(["GHSA-zzzz-yyyy-xxxx"]);
  });

  it("exige que o pacote da excecao confira com o advisory", () => {
    const r = avaliarAuditoria(relatorio(advisory("GHSA-g3hv-75wg-m249", "glob")), [excecao], "2026-11-03");
    expect(r.bloqueantes.map((b) => b.id)).toEqual(["GHSA-g3hv-75wg-m249"]);
  });

  it("aponta excecoes que nao correspondem a nenhum advisory atual", () => {
    expect(avaliarAuditoria({ vulnerabilities: {} }, [excecao], "2026-11-03").semUso).toEqual(["GHSA-g3hv-75wg-m249"]);
  });

  it("bloqueia advisory sem identificador GHSA", () => {
    const semId = { ...advisory("x"), url: "https://example.invalid/aviso" };
    expect(avaliarAuditoria(relatorio(semId), [], "2026-11-03").bloqueantes).toHaveLength(1);
  });

  it("valida o arquivo de excecoes", () => {
    expect(validarExcecoes([excecao])).toEqual([]);
    expect(validarExcecoes([{ ...excecao, motivo: "" }])).toHaveLength(1);
    expect(validarExcecoes([{ ...excecao, id: "CVE-1" }])).toHaveLength(1);
    expect(validarExcecoes([{ ...excecao, expira: "02/01/2027" }])).toHaveLength(1);
    expect(validarExcecoes([{ ...excecao, pacote: "" }])).toHaveLength(1);
    expect(validarExcecoes({})).toHaveLength(1);
  });
});

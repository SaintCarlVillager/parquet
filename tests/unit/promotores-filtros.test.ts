import { describe, expect, it } from "vitest";
import { filtrarPromotores } from "../../src/lib/promotoresFiltros";

const promotores = [
  { id: 1, tipo: "TITULAR", atuacao: "TODAS", varas: [1, 3] },
  { id: 2, tipo: "AUXILIAR", atuacao: "CUSTODIA", varas: [2] },
  { id: 3, tipo: "TITULAR", atuacao: "PLANTAO", varas: [] },
];
const semFiltros = { tipo: "", atuacao: "", varas: [] };

describe("filtros de promotores", () => {
  it("combina tipo e atuação com as varas selecionadas", () => {
    expect(filtrarPromotores(promotores, { tipo: "TITULAR", atuacao: "TODAS", varas: [3] }).map((p) => p.id)).toEqual([1]);
    expect(filtrarPromotores(promotores, { tipo: "TITULAR", atuacao: "TODAS", varas: [2] })).toEqual([]);
  });

  it("usa união para várias varas, considerando lista vazia como atuação em todas", () => {
    expect(filtrarPromotores(promotores, { ...semFiltros, varas: [2] }).map((p) => p.id)).toEqual([2, 3]);
    expect(filtrarPromotores(promotores, { ...semFiltros, varas: [1, 2] }).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("aplica tipo e atuação isolados e devolve tudo sem filtros", () => {
    expect(filtrarPromotores(promotores, { ...semFiltros, tipo: "AUXILIAR" }).map((p) => p.id)).toEqual([2]);
    expect(filtrarPromotores(promotores, { ...semFiltros, atuacao: "PLANTAO" }).map((p) => p.id)).toEqual([3]);
    expect(filtrarPromotores(promotores, semFiltros)).toEqual(promotores);
  });
});

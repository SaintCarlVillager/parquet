import { describe, expect, it } from "vitest";
import { atuaEm, atuaNaVara, coberturaAtiva, estaDisponivel, gerarEscala, limiteAudSemana, regraImpede } from "../../src/lib/gerador";
import type { PromotorInput, VagaInput } from "../../src/lib/gerador";

const base = (extra: Partial<PromotorInput> = {}): PromotorInput => ({
  id: 1,
  apelido: "Teste",
  tipo: "TITULAR",
  atuacao: "TODAS",
  varas: [1],
  ativo: true,
  portarias: [],
  coberturas: [],
  bloqueios: [],
  ...extra,
});

describe("regras puras do gerador", () => {
  it("respeita atuacao e vara", () => {
    expect(atuaEm({ atuacao: "CUSTODIA" }, "C")).toBe(true);
    expect(atuaEm({ atuacao: "CUSTODIA" }, "1")).toBe(false);
    expect(atuaNaVara({ varas: [1] }, "1")).toBe(true);
    expect(atuaNaVara({ varas: [1] }, "2")).toBe(false);
    expect(atuaNaVara({ varas: [] }, "2")).toBe(true);
  });

  it("filtra cobertura pela data, vara e tipo titular ou auxiliar", () => {
    const p = base({ coberturas: [{ inicio: "2026-09-01", fim: "2026-09-30", varas: [1], afastadoAuxiliar: false }] });
    expect(coberturaAtiva(p, "1", "2026-09-10")).toBeDefined();
    expect(coberturaAtiva(p, "1'", "2026-09-10")).toBeUndefined();
    expect(coberturaAtiva(p, "2", "2026-09-10")).toBeUndefined();
  });

  it("aplica regras de inclusao e excecao por dia", () => {
    expect(regraImpede([{ tipo: "EXCETO", diasCsv: "1,3", gruposCsv: "AUDIENCIAS" }], "AUDIENCIAS", 1)).toBe(true);
    expect(regraImpede([{ tipo: "EXCETO", diasCsv: "1,3", gruposCsv: "AUDIENCIAS" }], "AUDIENCIAS", 2)).toBe(false);
    expect(regraImpede([{ tipo: "SOMENTE", diasCsv: "1,3", gruposCsv: "AUDIENCIAS" }], "AUDIENCIAS", 2)).toBe(true);
  });

  it("limita secretario e sub-secretario somente quando aplicavel", () => {
    expect(limiteAudSemana(base({ cargo: "SECRETARIO" }), "2026-09-10")).toBe(true);
    expect(limiteAudSemana(base({ cargo: "SUBSECRETARIO" }), "2026-09-10")).toBe(false);
    expect(limiteAudSemana(base({ cargo: "SUBSECRETARIO", secretarioCoberto: [{ inicio: "2026-09-01", fim: "2026-09-30" }] }), "2026-09-10")).toBe(true);
  });

  it("preserva pre-alocacao valida e deixa vaga quando nao ha candidato", () => {
    const vagas: VagaInput[] = [
      { data: "2026-09-10", posicaoId: 1, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1, prePromotorId: 1 },
      { data: "2026-09-10", posicaoId: 2, codigo: "2", grupo: "AUDIENCIAS", peso: 1, ordem: 2 },
    ];
    const resultado = gerarEscala(vagas, [base()], { AUDIENCIAS: 1 });
    expect(resultado.alocacoes).toEqual([
      { data: "2026-09-10", posicaoId: 1, promotorId: 1, motivo: undefined },
      { data: "2026-09-10", posicaoId: 2, promotorId: null, motivo: "Sem candidato disponível" },
    ]);
    expect(resultado.vagaEmBranco).toBe(1);
  });

  it("permite custodia manual durante portaria, mas bloqueia demais cargos", () => {
    const p = base({ portarias: [{ inicio: "2026-09-01", fim: "2026-09-30" }] });
    expect(estaDisponivel(p, "2026-09-10", "C")).toBe(true);
    expect(estaDisponivel(p, "2026-09-10", "1")).toBe(false);
  });

  it("nao aloca audiencia no dia com custodia pre-alocada", () => {
    const vagas: VagaInput[] = [
      { data: "2026-09-10", posicaoId: 1, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1 },
    ];
    const resultado = gerarEscala(vagas, [base({ diasCustodia: ["2026-09-10"] })], { AUDIENCIAS: 1 });
    expect(resultado.alocacoes[0].promotorId).toBeNull();
  });
});

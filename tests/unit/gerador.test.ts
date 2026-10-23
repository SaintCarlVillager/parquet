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

describe("balanceamento de varas no periodo", () => {
  const ana = () => base({ id: 1, apelido: "Ana", varas: [1, 2] });
  const bruno = (extra: Partial<PromotorInput> = {}) => base({ id: 2, apelido: "Bruno", varas: [1, 2], ...extra });
  const idEm = (resultado: { alocacoes: { data: string; posicaoId: number; promotorId: number | null }[] }, posicaoId: number) =>
    resultado.alocacoes.find((a) => a.posicaoId === posicaoId)?.promotorId;

  it("prefere quem tem menos exposicoes a mesma vara no periodo", () => {
    const vagas: VagaInput[] = [
      { data: "2026-09-01", posicaoId: 10, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1, prePromotorId: 1 },
      { data: "2026-09-03", posicaoId: 11, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 2, prePromotorId: 1 },
      { data: "2026-09-05", posicaoId: 12, codigo: "2", grupo: "AUDIENCIAS", peso: 1, ordem: 3, prePromotorId: 2 },
      { data: "2026-09-08", posicaoId: 13, codigo: "1'", grupo: "AUDIENCIAS", peso: 1, ordem: 4 },
    ];
    const carga = new Map<number, Record<string, number>>([[2, { AUDIENCIAS: 5 }]]);
    const resultado = gerarEscala(vagas, [ana(), bruno()], { AUDIENCIAS: 1 }, carga);
    expect(idEm(resultado, 13)).toBe(2);
  });

  it("repete a vara quando so resta quem ja a fez", () => {
    const vagas: VagaInput[] = [
      { data: "2026-09-01", posicaoId: 10, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1, prePromotorId: 1 },
      { data: "2026-09-02", posicaoId: 11, codigo: "1'", grupo: "AUDIENCIAS", peso: 1, ordem: 2 },
    ];
    const resultado = gerarEscala(
      vagas,
      [ana(), bruno({ bloqueios: [{ posicaoId: null, data: "2026-09-02" }] })],
      { AUDIENCIAS: 1 }
    );
    expect(idEm(resultado, 11)).toBe(1);
  });

  it("titular e auxiliar da mesma vara compartilham a contagem", () => {
    const vagas: VagaInput[] = [
      { data: "2026-09-01", posicaoId: 10, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1, prePromotorId: 1 },
      { data: "2026-09-02", posicaoId: 11, codigo: "1'", grupo: "AUDIENCIAS", peso: 1, ordem: 2, prePromotorId: 1 },
      { data: "2026-09-03", posicaoId: 12, codigo: "2", grupo: "AUDIENCIAS", peso: 1, ordem: 3, prePromotorId: 2 },
      { data: "2026-09-04", posicaoId: 13, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 4 },
    ];
    const resultado = gerarEscala(vagas, [ana(), bruno()], { AUDIENCIAS: 1 });
    expect(idEm(resultado, 13)).toBe(2);
  });

  it("entre iguais em exposicao a vara fica a menor carga", () => {
    const zulu = base({ id: 2, apelido: "Zulu", varas: [1, 2] });
    const vagas: VagaInput[] = [
      { data: "2026-09-01", posicaoId: 10, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 1 },
    ];
    const carga = new Map<number, Record<string, number>>([[2, { AUDIENCIAS: 5 }]]);
    const resultado = gerarEscala(vagas, [ana(), zulu], { AUDIENCIAS: 1 }, carga);
    expect(idEm(resultado, 10)).toBe(1);
  });

  it("espalha a mesma vara entre promotores ao longo do periodo", () => {
    const vagas: VagaInput[] = [];
    for (let d = 1; d <= 6; d++) {
      const data = `2026-09-0${d}`;
      vagas.push({ data, posicaoId: 10 + d, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: d });
    }
    const resultado = gerarEscala(vagas, [ana(), bruno()], { AUDIENCIAS: 1 });
    const porPj = new Map<number, number>();
    for (const a of resultado.alocacoes) {
      if (!a.promotorId) continue;
      porPj.set(a.promotorId, (porPj.get(a.promotorId) ?? 0) + 1);
    }
    expect(porPj.get(1)).toBe(3);
    expect(porPj.get(2)).toBe(3);
  });

  it("desempata pela quantidade de designacoes antes do apelido", () => {
    const zulu = base({ id: 2, apelido: "Zulu", varas: [1, 2] });
    const vagas: VagaInput[] = [
      { data: "2026-09-10", posicaoId: 1, codigo: "C", grupo: "CUSTODIA", peso: 1, ordem: 1, prePromotorId: 1 },
      { data: "2026-09-08", posicaoId: 2, codigo: "1", grupo: "AUDIENCIAS", peso: 1, ordem: 2 },
    ];
    const resultado = gerarEscala(vagas, [zulu, ana()], { AUDIENCIAS: 1, CUSTODIA: 1 });
    expect(idEm(resultado, 2)).toBe(2);
  });
});

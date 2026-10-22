import { describe, expect, it } from "vitest";
import {
  chaveVisita,
  jaVisitou,
  marcarVisitado,
  passosDaRota,
  proximoIndice,
  type TourPasso,
} from "@/lib/tour";

const passosEditaveis: TourPasso[] = [
  { alvo: "[data-tour='x-titulo']", titulo: "Título", descricao: "d", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
  { alvo: "[data-tour='x-editar']", titulo: "Editar", descricao: "d", papeis: ["CHEFE"] },
  { alvo: "[data-tour='x-ajuste']", titulo: "Ajuste", descricao: "d", papeis: ["CHEFE", "OFICIAL"] },
];

describe("passosDaRota", () => {
  it("retorna vazio para rota desconhecida", () => {
    expect(passosDaRota("/inexistente", "CHEFE")).toEqual([]);
  });

  it("filtra passos pelo papel na rota", () => {
    const chefe = passosDaRota("/trocas", "CHEFE");
    expect(chefe.length).toBeGreaterThan(0);
    expect(chefe.every((p) => p.papeis.includes("CHEFE"))).toBe(true);
    const promotor = passosDaRota("/trocas", "PROMOTOR");
    expect(promotor.some((p) => p.titulo === "Lançar ajuste")).toBe(false);
  });

  it("CHEFE recebe passos de edicao", () => {
    const papel = "CHEFE";
    const resultado = passosEditaveis.filter((p) => p.papeis.includes(papel));
    expect(resultado.map((p) => p.titulo)).toContain("Editar");
  });

  it("PROMOTOR nao recebe passo de tela restrita", () => {
    const papel = "PROMOTOR";
    const resultado = passosEditaveis.filter((p) => p.papeis.includes(papel));
    expect(resultado.some((p) => p.titulo === "Editar")).toBe(false);
    expect(resultado.map((p) => p.titulo)).toContain("Título");
  });

  it("OFICIAL nao recebe passo que ensina edicao que nao pode fazer", () => {
    const papel = "OFICIAL";
    const resultado = passosEditaveis.filter((p) => p.papeis.includes(papel));
    expect(resultado.some((p) => p.titulo === "Editar")).toBe(false);
    expect(resultado.some((p) => p.titulo === "Ajuste")).toBe(true);
  });
});

describe("proximoIndice", () => {
  const passos: TourPasso[] = [
    { alvo: "a", titulo: "A", descricao: "", papeis: ["CHEFE"] },
    { alvo: "b", titulo: "B", descricao: "", papeis: ["CHEFE"] },
    { alvo: "c", titulo: "C", descricao: "", papeis: ["CHEFE"] },
  ];
  const existe = (alvo: string) => alvo !== "b";

  it("avanca pulando alvo ausente", () => {
    expect(proximoIndice(passos, 0, existe, true)).toBe(2);
  });

  it("volta pulando alvo ausente", () => {
    expect(proximoIndice(passos, 2, existe, false)).toBe(0);
  });

  it("retorna null quando nao ha alvo valido na direcao", () => {
    expect(proximoIndice([passos[1]], 0, existe, true)).toBeNull();
  });

  it("quando o atual esta ausente, encontra o proximo existente a frente", () => {
    expect(proximoIndice(passos, 1, existe, true)).toBe(2);
  });
});

describe("persistencia de visita", () => {
  function criaStorage() {
    const dados = new Map<string, string>();
    return {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => { dados.set(k, v); },
    };
  }

  it("chave e especifica por usuario", () => {
    expect(chaveVisita("a@mpsp.mp.br")).toBe("tour:a@mpsp.mp.br");
  });

  it("primeira visita nao esta marcada", () => {
    const storage = criaStorage();
    expect(jaVisitou(storage, "a@mpsp.mp.br")).toBe(false);
  });

  it("marcarVisitado persiste entre sessoes", () => {
    const storage = criaStorage();
    marcarVisitado(storage, "a@mpsp.mp.br");
    expect(jaVisitou(storage, "a@mpsp.mp.br")).toBe(true);
  });

  it("visita de um usuario nao contamina outro", () => {
    const storage = criaStorage();
    marcarVisitado(storage, "a@mpsp.mp.br");
    expect(jaVisitou(storage, "b@mpsp.mp.br")).toBe(false);
  });
});

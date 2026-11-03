import { describe, expect, it } from "vitest";
import { posicionarTooltip } from "../../src/lib/tour";

describe("posicao do tooltip do tour", () => {
  it("fica a direita do alvo quando ha espaco", () => {
    expect(posicionarTooltip({ top: 100, left: 50, width: 200, height: 40 }, { largura: 1366, altura: 850 })).toEqual({ top: 100, left: 262, maxWidth: 300 });
  });

  it("fica abaixo do alvo quando nao ha espaco lateral", () => {
    expect(posicionarTooltip({ top: 100, left: 800, width: 500, height: 40 }, { largura: 1366, altura: 850 })).toEqual({ top: 152, left: 800, maxWidth: 300 });
  });

  it("nunca ultrapassa a borda direita em telas estreitas", () => {
    const t = posicionarTooltip({ top: 600, left: 280, width: 90, height: 40 }, { largura: 390, altura: 844 });
    expect(t.left).toBeGreaterThanOrEqual(8);
    expect(t.left + t.maxWidth).toBeLessThanOrEqual(390 - 8);
  });

  it("limita a largura ao viewport em telas muito estreitas", () => {
    const t = posicionarTooltip({ top: 10, left: 0, width: 280, height: 40 }, { largura: 280, altura: 600 });
    expect(t).toMatchObject({ left: 8, maxWidth: 264 });
  });

  it("mantem o tooltip dentro da altura visivel", () => {
    expect(posicionarTooltip({ top: 900, left: 10, width: 500, height: 40 }, { largura: 600, altura: 700 }).top).toBe(580);
  });
});

import { jaVisitou, marcarVisitado } from "../../src/lib/tour";

describe("armazenamento do tour indisponivel", () => {
  const bloqueado = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  };

  it("considera visitado e nao abre o tour quando o storage falha", () => {
    expect(jaVisitou(bloqueado, "a@b")).toBe(true);
  });

  it("ignora falha ao marcar visita", () => {
    expect(() => marcarVisitado(bloqueado, "a@b")).not.toThrow();
  });
});

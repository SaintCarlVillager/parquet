import { describe, expect, it } from "vitest";
import { diasDoMes, diaSemana, segundaDe, semanasDoMes, toISODate } from "../../src/lib/datas";

describe("datas", () => {
  it("converte datas locais para ISO", () => {
    expect(toISODate(new Date(2026, 8, 11))).toBe("2026-09-11");
  });

  it("identifica dia da semana sem deslocamento UTC", () => {
    expect(diaSemana("2026-09-11")).toBe(5);
  });

  it("encontra a segunda-feira da semana", () => {
    expect(segundaDe("2026-09-11")).toBe("2026-09-07");
    expect(segundaDe("2026-09-07")).toBe("2026-09-07");
  });

  it("lista corretamente meses com 28, 30 e 31 dias", () => {
    expect(diasDoMes(2026, 2)).toHaveLength(28);
    expect(diasDoMes(2026, 4)).toHaveLength(30);
    expect(diasDoMes(2026, 9)).toHaveLength(30);
  });

  it("monta semanas completas cobrindo o mes", () => {
    const semanas = semanasDoMes(2026, 9);
    expect(semanas[0]).toEqual(["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(semanas.at(-1)?.at(-1)).toBe("2026-10-04");
  });
});

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

  it("omite semana fantasma quando o mes comeca no domingo", () => {
    const semanas = semanasDoMes(2026, 11);
    expect(semanas[0]?.[0]).toBe("2026-11-02");
    expect(semanas[0]).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("omite semana fantasma quando o mes comeca no sabado", () => {
    const semanas = semanasDoMes(2026, 8);
    expect(semanas[0]?.[0]).toBe("2026-08-03");
    expect(semanas[0]?.slice(0, 5)).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("mantem semana parcial com pelo menos um dia util do mes", () => {
    const semanas = semanasDoMes(2026, 11);
    expect(semanas.at(-1)?.slice(0, 5)).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
    ]);
  });
});

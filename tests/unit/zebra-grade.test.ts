import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../..");

function ler(relativo: string): string {
  return readFileSync(resolve(raiz, relativo), "utf8");
}

describe("zebra na grade (contrato visual)", () => {
  const css = ler("src/app/globals.css");

  it("define token --zebra e aplica nas linhas pares da escala", () => {
    expect(css).toMatch(/--zebra:\s*#[0-9a-fA-F]{3,8}/);
    expect(css).toMatch(/\.grade-semanal\s+tbody\s+tr:nth-child\(even\)\s+td/);
    expect(css).toMatch(/background:\s*var\(--zebra\)/);
  });

  it("preserva custodia por cima da zebra", () => {
    const zebraIdx = css.search(/\.grade-semanal\s+tbody\s+tr:nth-child\(even\)\s+td/);
    const custodiaIdx = css.search(/\.grade-semanal\s+\.custodia-row\s+td/);
    expect(zebraIdx).toBeGreaterThanOrEqual(0);
    expect(custodiaIdx).toBeGreaterThan(zebraIdx);
    expect(css).toMatch(/\.grade-semanal\s+\.custodia-row\s+td\s*\{[^}]*background:\s*var\(--custodia\)/s);
  });

  it("forca cor da zebra na impressao/PDF", () => {
    expect(css).toMatch(/\.grade-semanal\s+tbody\s+tr:nth-child\(even\)\s+td[\s\S]*?print-color-adjust:\s*exact/);
    expect(css).toMatch(/\.table-zebra\s+tbody\s+tr:nth-child\(even\)\s+td[\s\S]*?print-color-adjust:\s*exact/);
  });

  it("oferece classe reutilizavel table-zebra para Excecoes e /grade", () => {
    expect(css).toMatch(/\.table-zebra\s+tbody\s+tr:nth-child\(even\)\s+td/);
  });

  it("GradeView e ExcecoesView usam table-zebra", () => {
    const grade = ler("src/app/(app)/grade/GradeView.tsx");
    const excecoes = ler("src/app/(app)/excecoes/ExcecoesView.tsx");
    expect(grade).toMatch(/className=["'][^"']*table-zebra/);
    expect(excecoes).toMatch(/className=["'][^"']*table-zebra/);
  });
});

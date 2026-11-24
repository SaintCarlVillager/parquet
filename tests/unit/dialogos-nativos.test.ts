import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../..");
const pasta = resolve(raiz, "src/app");
const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
const ler = (relativo: string) => readFileSync(resolve(pasta, relativo), "utf8");

describe("dialogos nativos e regioes vivas", () => {
  it("nenhuma tela usa window.confirm ou alert fora do fallback do ConfirmacaoProvider", () => {
    for (const arquivo of arquivos) {
      if (arquivo.endsWith("ConfirmacaoProvider.tsx")) continue;
      expect(ler(arquivo), arquivo).not.toMatch(/(^|[^\w.])(window\.)?(confirm|alert)\(/);
    }
  });

  it("mensagens condicionais de erro e sucesso ficam dentro de regiao viva sempre montada", () => {
    for (const arquivo of arquivos) {
      const conteudo = ler(arquivo);
      for (const m of conteudo.matchAll(/\{\w+ && <p className="(erro|ok|sucesso)">/g)) {
        const antes = conteudo.slice(Math.max(0, m.index! - 30), m.index);
        expect(antes, `${arquivo}: ${m[0]}`).toMatch(/<div role="(alert|status)">$/);
      }
    }
  });

  it("dialogo de confirmacao usa showModal sem role nem aria-modal manuais", () => {
    const provider = ler("components/ConfirmacaoProvider.tsx");
    expect(provider).toMatch(/<dialog/);
    expect(provider).toMatch(/showModal\(\)/);
    expect(provider).not.toMatch(/role="dialog"|aria-modal/);
    expect(provider).toMatch(/<form method="dialog">/);
  });

  it("css contem rolagem do fundo do modal e valida campos so apos interacao", () => {
    const css = readFileSync(resolve(pasta, "globals.css"), "utf8");
    expect(css).toMatch(/\.dialogo:modal\s*\{[^}]*overscroll-behavior:\s*contain/);
    expect(css).toMatch(/\.dialogo::backdrop\s*\{[^}]*overscroll-behavior:\s*contain/);
    expect(css).toMatch(/input:user-invalid/);
    expect(css).not.toMatch(/(input|select|textarea):invalid/);
  });
});

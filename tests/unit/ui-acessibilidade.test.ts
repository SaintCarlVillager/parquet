import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../..");

function ler(relativo: string): string {
  return readFileSync(resolve(raiz, relativo), "utf8");
}

describe("contrato visual de acessibilidade e craft", () => {
  const css = ler("src/app/globals.css");
  const layout = ler("src/app/layout.tsx");
  const appLayout = ler("src/app/(app)/layout.tsx");
  const login = ler("src/app/login/page.tsx");
  const sideNav = ler("src/app/components/SideNav.tsx");

  it("preserva marca MPSP nos tokens", () => {
    expect(css).toMatch(/--vermelho:\s*#C40008/i);
    expect(css).toMatch(/--preto:\s*#212125/i);
  });

  it("oferece skip link e ancora de conteudo", () => {
    expect(layout).toMatch(/pular-para-conteudo/);
    expect(layout).toMatch(/#conteudo-principal/);
    expect(appLayout).toMatch(/id=["']conteudo-principal["']/);
    expect(css).toMatch(/\.pular-para-conteudo/);
  });

  it("usa focus-visible e respeita prefers-reduced-motion", () => {
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).not.toMatch(/transition:\s*all\b/);
  });

  it("login tem rotulos, autocomplete e alerta acessivel", () => {
    expect(login).toMatch(/htmlFor=["']login-email["']/);
    expect(login).toMatch(/autoComplete=["']username["']/);
    expect(login).toMatch(/spellCheck=\{false\}/);
    expect(login).toMatch(/role=["']alert["']/);
    expect(login).toMatch(/Entrando…/);
  });

  it("sidebar marca pagina atual e rotula o tour", () => {
    expect(sideNav).toMatch(/aria-label=["']Principal["']/);
    expect(sideNav).toMatch(/aria-current=\{ativo \? ["']page["'] : undefined\}/);
    expect(sideNav).toMatch(/aria-label=\{primeiraVisita/);
    expect(sideNav).toMatch(/Saindo…/);
  });
});

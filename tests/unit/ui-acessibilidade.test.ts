import { readdirSync, readFileSync } from "node:fs";
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

  it("nao deixa rotulo de formulario solto sem controle associado", () => {
    const pasta = resolve(raiz, "src/app/(app)");
    const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos) {
      expect(ler(`src/app/(app)/${arquivo}`), arquivo).not.toMatch(/<label>/);
    }
  });

  it("usa apenas tokens de cor definidos", () => {
    const definidos = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map((m) => m[1]));
    const pasta = resolve(raiz, "src/app");
    const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => /\.(tsx|css)$/.test(f));
    for (const arquivo of arquivos) {
      for (const m of ler(`src/app/${arquivo}`).matchAll(/var\((--[a-z0-9-]+)\)/gi)) {
        expect(definidos.has(m[1]), `${arquivo}: ${m[1]}`).toBe(true);
      }
    }
  });

  it("texto secundario tem contraste AA sobre o fundo da pagina", () => {
    const cor = (nome: string) => css.match(new RegExp(`${nome}:\\s*(#[0-9a-f]{6})`, "i"))?.[1] ?? "";
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [a, b] = [lum(cor("--muted")), lum(cor("--bg"))].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("grupos de caixas de selecao usam fieldset sem moldura padrao", () => {
    expect(css).toMatch(/\.grupo-campos\s*\{[^}]*border:\s*0/);
    expect(css).toMatch(/\.rotulo-campo/);
  });

  it("cada pagina tem um h1 e o login fica em landmark main", () => {
    const pasta = resolve(raiz, "src/app/(app)");
    const paginas = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
    const comTitulo = paginas.map((f) => ler(`src/app/(app)/${f}`)).filter((c) => /data-tour=\{?["'`][^"'`]*-titulo/.test(c));
    expect(comTitulo.length).toBeGreaterThanOrEqual(12);
    for (const conteudo of comTitulo) expect(conteudo).toMatch(/<h1 className="page-titulo[^"]*" data-tour=/);
    expect(login).toMatch(/<main className="login-fundo"/);
  });

  it("hierarquia de titulos nao pula de h1 para h3 e colunas de acao tem nome", () => {
    const pasta = resolve(raiz, "src/app");
    const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
    for (const arquivo of arquivos) {
      const conteudo = ler(`src/app/${arquivo}`);
      expect(conteudo, arquivo).not.toMatch(/<h3[\s>]/);
      expect(conteudo, arquivo).not.toMatch(/<th( className="no-print")?><\/th>/);
    }
    expect(css).not.toMatch(/(^|\n)\.page-titulo,\s*\nh2\s*\{/);
  });

  it("paineis contem elementos sr-only dentro da rolagem horizontal", () => {
    expect(css).toMatch(/\.panel\s*\{[^}]*position:\s*relative/);
  });
});

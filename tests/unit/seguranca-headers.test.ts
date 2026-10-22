import { describe, expect, it } from "vitest";
import config from "../../next.config.mjs";

type CabecalhoConfig = { source: string; headers: { key: string; value: string }[] };

const configTipada = config as { headers?: () => Promise<CabecalhoConfig[]> };

async function cabecalhosGlobais(): Promise<Map<string, string>> {
  const regras = (await configTipada.headers?.()) ?? [];
  const todas: CabecalhoConfig[] = regras.filter((r) => r.source === "/(.*)");
  expect(todas.length).toBeGreaterThan(0);
  return new Map(todas.flatMap((r) => r.headers.map((h) => [h.key.toLowerCase(), h.value])));
}

describe("cabecalhos de seguranca", () => {
  it("aplica os cabecalhos basicos em todas as rotas", async () => {
    const h = await cabecalhosGlobais();
    expect(h.get("x-content-type-options")).toBe("nosniff");
    expect(h.get("x-frame-options")).toBe("DENY");
    expect(h.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("permissions-policy")).toContain("camera=()");
    expect(h.get("strict-transport-security")).toContain("max-age=");
  });

  it("publica uma CSP restritiva sem liberar origem externa de script", async () => {
    const csp = (await cabecalhosGlobais()).get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });
});

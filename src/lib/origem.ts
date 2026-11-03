const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export function origemPermitida(req: Request): boolean {
  if (METODOS_SEGUROS.has(req.method.toUpperCase())) return true;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origem = req.headers.get("origin");
  if (origem === null) return true;
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

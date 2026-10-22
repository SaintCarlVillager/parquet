const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const host = new URL(BASE).hostname;
if (process.env.VERCEL_ENV === "production" || host === "viladesaocarlos.vercel.app") {
  throw new Error("E2E bloqueado: nunca execute validadores contra Production");
}
if (!(["localhost", "127.0.0.1", "::1"].includes(host)) && process.env.E2E_ALLOW_REMOTE !== "1") {
  throw new Error("E2E bloqueado: use servidor local ou defina E2E_ALLOW_REMOTE=1 explicitamente");
}
const email = process.env.SESSAO_EMAIL;
const senha = process.env.SESSAO_SENHA ?? process.env.E2E_SENHA;
if (!email || !senha) {
  console.error("PRE-SESSAO: defina SESSAO_EMAIL e E2E_SENHA (ou SESSAO_SENHA) no ambiente. Nao ha login padrao.");
  process.exit(1);
}

const r = await fetch(BASE + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, senha }),
});
if (!r.ok) {
  console.error("PRE-SESSAO: login falhou", r.status, await r.text());
  process.exit(1);
}
const setCookie = r.headers.get("set-cookie") ?? "";
const cookie = setCookie.split(";")[0];
console.log("PRE-SESSAO: logado como", (await r.json()).papel);

const original = globalThis.fetch;
const comCookie = (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
  if (url.startsWith(BASE)) {
    init.headers = new Headers(init.headers);
    if (!init.headers.has("cookie")) init.headers.set("cookie", cookie);
  }
  return original(input, init);
};
const ESPERA_MS = 500;
const TENTATIVAS = 4;
globalThis.fetch = async function fetchRetry(input, init) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      return await comCookie(input, init);
    } catch (erro) {
      const codigo = erro?.cause?.code ?? erro?.code;
      const recuperavel = codigo === "ECONNRESET" || codigo === "ECONNREFUSED" || codigo === "EPIPE" || codigo === "ETIMEDOUT";
      ultimoErro = erro;
      if (!recuperavel || tentativa === TENTATIVAS) break;
      await new Promise((r) => setTimeout(r, ESPERA_MS * tentativa));
    }
  }
  throw ultimoErro;
};

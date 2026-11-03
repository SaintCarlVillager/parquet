import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const GHSA = /GHSA(-[0-9a-z]{4}){3}/i;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validarExcecoes(excecoes) {
  if (!Array.isArray(excecoes)) return ["arquivo de excecoes deve ser uma lista"];
  const erros = [];
  excecoes.forEach((e, i) => {
    if (!e || typeof e !== "object") return erros.push(`excecao ${i}: formato invalido`);
    if (typeof e.id !== "string" || !GHSA.test(e.id)) erros.push(`excecao ${i}: id deve ser um GHSA`);
    if (typeof e.pacote !== "string" || !e.pacote.trim()) erros.push(`excecao ${i}: pacote obrigatorio`);
    if (typeof e.motivo !== "string" || !e.motivo.trim()) erros.push(`excecao ${i}: motivo obrigatorio`);
    if (typeof e.expira !== "string" || !DATA_ISO.test(e.expira)) erros.push(`excecao ${i}: expira deve ser YYYY-MM-DD`);
  });
  return erros;
}

function advisoriesDo(relatorio) {
  const vistos = new Map();
  for (const vulnerabilidade of Object.values(relatorio?.vulnerabilities ?? {})) {
    for (const via of vulnerabilidade?.via ?? []) {
      if (!via || typeof via !== "object") continue;
      const id = String(via.url ?? "").match(GHSA)?.[0] ?? `sem-id:${via.source ?? via.title ?? "?"}`;
      vistos.set(`${id}|${via.name}`, { id, pacote: via.name, severidade: via.severity, titulo: via.title, faixa: via.range });
    }
  }
  return [...vistos.values()];
}

export function avaliarAuditoria(relatorio, excecoes, hoje) {
  const bloqueantes = [];
  const ignoradas = [];
  const usadas = new Set();
  for (const advisory of advisoriesDo(relatorio)) {
    const excecao = excecoes.find((e) => e.id === advisory.id && e.pacote === advisory.pacote);
    if (!excecao) {
      bloqueantes.push({ ...advisory, motivo: "sem excecao registrada" });
      continue;
    }
    usadas.add(excecao.id);
    if (hoje > excecao.expira) {
      bloqueantes.push({ ...advisory, motivo: `excecao expirou em ${excecao.expira}` });
      continue;
    }
    ignoradas.push({ ...advisory, motivo: excecao.motivo, expira: excecao.expira });
  }
  const semUso = excecoes.filter((e) => !usadas.has(e.id)).map((e) => e.id);
  return { bloqueantes, ignoradas, semUso };
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function executar() {
  const arquivo = fileURLToPath(new URL("./audit-excecoes.json", import.meta.url));
  const excecoes = JSON.parse(readFileSync(arquivo, "utf8"));
  const errosArquivo = validarExcecoes(excecoes);
  if (errosArquivo.length) {
    console.error(`Excecoes invalidas em ${arquivo}:\n- ${errosArquivo.join("\n- ")}`);
    process.exit(1);
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const saida = spawnSync(npm, ["audit", "--omit=dev", "--json"], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  let relatorio;
  try {
    relatorio = JSON.parse(saida.stdout);
  } catch {
    console.error(`npm audit nao devolveu JSON (status ${saida.status}).\n${saida.stderr ?? ""}`);
    process.exit(1);
  }
  if (relatorio.error) {
    console.error(`npm audit falhou: ${JSON.stringify(relatorio.error)}`);
    process.exit(1);
  }
  const { bloqueantes, ignoradas, semUso } = avaliarAuditoria(relatorio, excecoes, hojeISO());
  for (const a of ignoradas) console.log(`IGNORADO ate ${a.expira}: ${a.id} (${a.pacote} ${a.faixa ?? ""}, ${a.severidade}) - ${a.motivo}`);
  for (const id of semUso) console.warn(`AVISO: excecao ${id} nao corresponde a nenhum advisory atual; remova-a de scripts/audit-excecoes.json`);
  if (bloqueantes.length) {
    for (const a of bloqueantes) console.error(`BLOQUEANTE: ${a.id} (${a.pacote} ${a.faixa ?? ""}, ${a.severidade}) - ${a.titulo ?? ""} [${a.motivo}]`);
    process.exit(1);
  }
  console.log("Auditoria OK: nenhuma vulnerabilidade de producao sem excecao vigente.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) executar();

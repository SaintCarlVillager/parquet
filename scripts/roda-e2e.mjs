import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extrairGrupo, selecionarScripts } from "./e2e-args.mjs";

const scripts = readdirSync("scripts")
  .filter((nome) => /^valida.*\.mjs$/.test(nome))
  .sort((a, b) => {
    if (a === "valida-reset.mjs") return 1;
    if (b === "valida-reset.mjs") return -1;
    return a.localeCompare(b);
  });
const grupos = {
  gerador: ["valida-ajustes.mjs", "valida-atuacao.mjs", "valida-atuacao2.mjs", "valida-custodia.mjs", "valida-custodia-prioridade.mjs", "valida-dias-seguidos.mjs", "valida-genericos.mjs", "valida-heranca.mjs", "valida-pjs-aux.mjs", "valida-semanas.mjs", "valida-semplantao.mjs", "valida-toggle.mjs", "valida-varas.mjs", "valida-varas2.mjs"],
  regras: ["valida-excecoes.mjs", "valida-regras.mjs", "valida-rotulos.mjs"],
  portarias: ["valida-custodia-afastado.mjs", "valida-portarias.mjs", "valida-secretario.mjs", "valida-secretario2.mjs"],
  exportacao: ["valida-ajustes.mjs", "valida-excel-config.mjs", "valida-rotulos.mjs", "valida-semplantao.mjs"],
  autorizacao: ["valida.mjs", "valida2.mjs"],
};
const grupo = extrairGrupo(process.argv, grupos);
const scriptsExecutar = selecionarScripts(scripts, grupos, grupo, process.env.E2E_FROM);
const preload = pathToFileURL(resolve("scripts", "pre-sessao.mjs")).href;
const prepara = resolve("scripts", "prepara-e2e.mjs");
const limpeza = resolve("scripts", "limpeza.mjs");

function executar(script) {
  console.log(`\n=== ${script} ===`);
  return spawnSync(process.execPath, ["--env-file=.env", "--import", preload, resolve("scripts", script)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

function limpar() {
  console.log("\n=== limpeza ===");
  return spawnSync(process.execPath, ["--env-file=.env", "--import", preload, limpeza], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

function preparar() {
  return spawnSync(process.execPath, ["--env-file=.env", "--import", preload, prepara], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

let falha = null;
let limpezaResultado;
try {
  for (const script of scriptsExecutar) {
    console.log("\n=== preparar escala ===");
    const preparacao = preparar();
    if (preparacao.status !== 0) {
      falha = { script: "prepara-e2e.mjs", status: preparacao.status ?? 1 };
      break;
    }
    const resultado = executar(script);
    if (resultado.status !== 0) {
      falha = { script, status: resultado.status ?? 1 };
      break;
    }
  }
} finally {
  limpezaResultado = limpar();
}
if (falha) process.exit(falha.status);
if (limpezaResultado.status !== 0) process.exit(limpezaResultado.status ?? 1);

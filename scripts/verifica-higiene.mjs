import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { eArquivoDeTeste, nomeProibido, verificarArquivo } from "./higiene.mjs";

function git(cmd) {
  return execSync(cmd, { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}

const rastreados = git("git ls-files");
const naoRastreados = git("git ls-files --others --exclude-standard");
const arquivos = [...new Set([...rastreados, ...naoRastreados])];

let problemas = 0;
for (const caminho of arquivos) {
  let conteudo = "";
  try {
    conteudo = readFileSync(caminho, "utf8");
  } catch {
    conteudo = "";
  }
  let achados;
  if (eArquivoDeTeste(caminho)) {
    const nome = nomeProibido(caminho);
    achados = nome ? [`nome proibido: ${nome}`] : [];
  } else {
    achados = verificarArquivo(caminho, conteudo);
  }
  for (const problema of achados) {
    console.error(`HIGIENE: ${caminho}: ${problema}`);
    problemas += 1;
  }
}

if (problemas > 0) {
  console.error(`Higiene falhou: ${problemas} problema(s) encontrado(s).`);
  process.exit(1);
}
console.log("Higiene OK: sem arquivos proibidos ou segredos.");

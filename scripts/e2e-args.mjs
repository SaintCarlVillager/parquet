export function extrairGrupo(argv, grupos) {
  const indice = argv.indexOf("--group");
  if (indice < 0) return null;
  const grupo = argv[indice + 1];
  if (!grupo || grupo.startsWith("--")) throw new Error("--group exige um nome de grupo");
  if (!Object.prototype.hasOwnProperty.call(grupos, grupo)) {
    throw new Error(`Grupo E2E nao encontrado: ${grupo}`);
  }
  return grupo;
}

export function selecionarScripts(scripts, grupos, grupo, inicio) {
  const selecionados = grupo ? new Set(grupos[grupo]) : null;
  const filtrados = selecionados ? scripts.filter((script) => selecionados.has(script)) : scripts;
  if (!inicio) return filtrados;
  const indice = filtrados.indexOf(inicio);
  if (indice < 0) throw new Error(`Validador nao encontrado: ${inicio}`);
  return filtrados.slice(indice);
}

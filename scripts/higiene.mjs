export const NOMES_PROIBIDOS = [
  { nome: "arquivo de ambiente", re: /^\.env(?!\.example$)/i },
  { nome: "artefato temporario de exportacao", re: /^tmp-.*\.xlsx$/i },
  { nome: "arquivo de chave", re: /\.(pem|key|p12|pfx|ppk)$/i },
  { nome: "chave id_rsa/id_ed25519", re: /^id_(rsa|ed25519|ecdsa|dsa)$/i },
  { nome: "credenciais", re: /^credentials$/i },
  { nome: "secrets", re: /^secrets?\..*$/i },
];

export const PADROES_CONTEUDO = [
  { nome: "chave privada", re: /-----BEGIN (RSA |EC |OPENSSH |PGP |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  { nome: "chave AWS", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nome: "senha Neon", re: /\bnpg_[A-Za-z0-9]+\b/ },
  { nome: "URL de banco remota com senha", re: /postgres(?:ql)?:\/\/[^:\/\s]+:[^@\s]+@(?!localhost|127\.0\.0\.1)([^\/\s]+)/ },
];

const BINARIOS = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|xlsx|zip)$/i;

export function eArquivoDeTeste(caminho) {
  return /(^|[\\/])tests[\\/]/.test(caminho) || /\.test\.(ts|tsx|mjs|js)$/.test(caminho) || /(^|[\\/])fixtures[\\/]/.test(caminho);
}

export function nomeProibido(caminho) {
  const base = String(caminho).split(/[\\/]/).pop() ?? "";
  const achado = NOMES_PROIBIDOS.find(({ re }) => re.test(base));
  return achado ? achado.nome : null;
}

export function conteudoSuspeito(texto) {
  const achados = [];
  for (const { nome, re } of PADROES_CONTEUDO) {
    if (re.test(texto)) achados.push(nome);
  }
  return achados;
}

export function verificarArquivo(caminho, conteudo) {
  const problemas = [];
  const nome = nomeProibido(caminho);
  if (nome) problemas.push(`nome proibido: ${nome}`);
  if (!BINARIOS.test(String(caminho))) {
    for (const achado of conteudoSuspeito(conteudo ?? "")) {
      problemas.push(`segredo em conteudo: ${achado}`);
    }
  }
  return problemas;
}

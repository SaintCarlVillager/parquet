export function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(`FALHA E2E: ${mensagem}`);
}

export function exigirStatus(resposta, esperado, contexto) {
  exigir(resposta.status === esperado, `${contexto}: esperado HTTP ${esperado}, recebido ${resposta.status}`);
}

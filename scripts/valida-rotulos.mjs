import { exigir, exigirStatus } from "./assert.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const solicitar = async (path, method = "GET", dados) => {
  const resposta = await fetch(base + path, {
    method,
    ...(dados === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }),
  });
  return { resposta, corpo: await resposta.json().catch(() => null) };
};
const escalas = await solicitar("/api/escalas");
const escala = escalas.corpo.find((item) => item.ano === 2026 && item.mes === 9);
exigir(escala, "escala de setembro de 2026 nao encontrada");
const detalhe = await solicitar(`/api/escalas/${escala.id}`);
const dados = detalhe.corpo;
const posicaoPorId = new Map(dados.posicoes.map((posicao) => [posicao.id, posicao]));

function rotulo(designacao, fonte = dados) {
  if (!designacao?.promotorId) return "";
  const promotor = fonte.promotores.find((item) => item.id === designacao.promotorId);
  const posicao = fonte.posicoes.find((item) => item.id === designacao.posicaoId);
  exigir(promotor && posicao, "designacao referencia promotor ou posicao inexistente");
  const match = /^(\d)('?)$/.exec(posicao.codigo);
  const cobertura = match && (promotor.coberturas ?? []).find((item) =>
    item.inicio <= designacao.data && designacao.data <= item.fim &&
    (!!item.afastadoAuxiliar === (match[2] === "'")) &&
    (!item.varas?.length || item.varas.includes(Number(match[1])))
  );
  if (cobertura) {
    const afastado = fonte.promotores.find((item) => item.id === cobertura.afastadoId);
    exigir(afastado, "cobertura sem promotor afastado");
    const modalidades = { DESIGNADO: "designado para", ACUMULACAO: "acumulando", AUXILIO: "auxiliando" };
    return `${modalidades[cobertura.modalidade] ?? "cobrindo"} ${afastado.apelido}`;
  }
  if (promotor.generico && /^\d'$/.test(posicao.codigo)) return "ajudando na auxiliar";
  return "";
}

const pjs = dados.promotores.find((promotor) => promotor.apelido === "PJS" && promotor.ativo);
exigir(pjs?.generico, "PJS generico ativo nao encontrado");
const auxiliarPjs = dados.designacoes.find((designacao) =>
  designacao.promotorId === pjs.id && /^\d'$/.test(posicaoPorId.get(designacao.posicaoId)?.codigo ?? "")
);
exigir(auxiliarPjs, "PJS nao possui designacao em posicao auxiliar");
exigir(rotulo(auxiliarPjs) === "ajudando na auxiliar", "rotulo de PJS na auxiliar incorreto");
console.log("rotulo PJS auxiliar: ajudando na auxiliar");

const designacaoTeste = dados.designacoes.find((designacao) => {
  const posicao = posicaoPorId.get(designacao.posicaoId);
  return designacao.promotorId && !designacao.travada && posicao?.grupo === "AUDIENCIAS" && /^(\d)('?)$/.test(posicao.codigo);
});
exigir(designacaoTeste, "nenhuma audiencia ocupada e destravada para testar rotulo de cobertura");
const posicaoTeste = posicaoPorId.get(designacaoTeste.posicaoId);
const tipoTeste = posicaoTeste.codigo.endsWith("'") ? "AUXILIAR" : "TITULAR";
const promotorOriginalId = designacaoTeste.promotorId;
const sufixo = Date.now();
let afastado;
let cobridor;
let portariaId;
let designacaoAlterada = false;
try {
  const criadoAfastado = await solicitar("/api/promotores", "POST", {
    nome: "Teste rotulo afastado",
    apelido: `TESTE-ROT-A-${sufixo}`,
    tipo: tipoTeste,
    atuacao: "TODAS",
  });
  exigirStatus(criadoAfastado.resposta, 201, "criar promotor afastado para teste de rotulo");
  afastado = criadoAfastado.corpo;
  const criadoCobridor = await solicitar("/api/promotores", "POST", {
    nome: "Teste rotulo cobridor",
    apelido: `TESTE-ROT-C-${sufixo}`,
    tipo: tipoTeste,
    atuacao: "TODAS",
  });
  exigirStatus(criadoCobridor.resposta, 201, "criar promotor cobridor para teste de rotulo");
  cobridor = criadoCobridor.corpo;

  const alocadoAfastado = await solicitar(`/api/designacoes/${designacaoTeste.id}`, "PATCH", { promotorId: afastado.id });
  exigirStatus(alocadoAfastado.resposta, 200, "alocar designacao ao afastado de teste");
  designacaoAlterada = true;
  const criadaPortaria = await solicitar("/api/portarias", "POST", {
    numero: `ROTULO-${sufixo}`,
    promotorAfastadoId: afastado.id,
    promotorCobridorId: cobridor.id,
    modalidade: "ACUMULACAO",
    inicio: designacaoTeste.data,
    fim: designacaoTeste.data,
  });
  exigirStatus(criadaPortaria.resposta, 201, "criar portaria de cobertura para teste de rotulo");
  portariaId = criadaPortaria.corpo.id;
  const alocadoCobridor = await solicitar(`/api/designacoes/${designacaoTeste.id}`, "PATCH", { promotorId: cobridor.id });
  exigirStatus(alocadoCobridor.resposta, 200, "alocar cobridor de teste");

  const atualizada = await solicitar(`/api/escalas/${escala.id}`);
  const designacaoAtualizada = atualizada.corpo.designacoes.find((item) => item.id === designacaoTeste.id);
  exigir(designacaoAtualizada?.promotorId === cobridor.id, "a designacao nao preservou o cobridor de teste");
  exigir(rotulo(designacaoAtualizada, atualizada.corpo) === `acumulando ${afastado.apelido}`, "rotulo de acumulacao nao corresponde ao promotor afastado");
  console.log("rotulo de cobertura: acumulando promotor afastado");

  const exportacao = await fetch(`${base}/api/escalas/${escala.id}/export`);
  exigirStatus(exportacao, 200, "exportacao da escala");
  console.log("exportacao:", exportacao.status);
} finally {
  if (portariaId) await solicitar(`/api/portarias/${portariaId}`, "DELETE");
  if (designacaoAlterada) await solicitar(`/api/designacoes/${designacaoTeste.id}`, "PATCH", { promotorId: promotorOriginalId });
  if (cobridor?.id) await solicitar(`/api/promotores/${cobridor.id}`, "DELETE");
  if (afastado?.id) await solicitar(`/api/promotores/${afastado.id}`, "DELETE");
}
console.log("FIM");

import { MODALIDADES_PORTARIA } from "./datas";
import { dataISO, inteiroPositivo } from "./validacao";

export interface PortariaDados {
  promotorAfastadoId: number;
  promotorCobridorId: number | null;
  modalidade: string;
  inicio: string;
  fim: string;
}

export function validarPortaria(body: {
  promotorAfastadoId?: unknown;
  promotorCobridorId?: unknown;
  modalidade?: unknown;
  inicio?: unknown;
  fim?: unknown;
}): { erro?: string; dados?: PortariaDados } {
  const promotorAfastadoId = inteiroPositivo(body.promotorAfastadoId);
  if (!promotorAfastadoId) return { erro: "Selecione o promotor afastado" };
  const inicio = dataISO(body.inicio);
  const fim = dataISO(body.fim);
  if (!inicio || !fim) {
    return { erro: "Informe as datas de início e fim" };
  }
  if (inicio > fim) return { erro: "Data de início posterior à data de fim" };
  const promotorCobridorId = body.promotorCobridorId === null || body.promotorCobridorId === "" || body.promotorCobridorId === undefined
    ? null
    : inteiroPositivo(body.promotorCobridorId);
  if (body.promotorCobridorId !== null && body.promotorCobridorId !== "" && body.promotorCobridorId !== undefined && !promotorCobridorId) {
    return { erro: "Promotor cobridor invalido" };
  }
  if (promotorCobridorId === promotorAfastadoId) {
    return { erro: "O promotor que cobre não pode ser o próprio afastado" };
  }
  const modalidade = MODALIDADES_PORTARIA.includes(String(body.modalidade)) ? String(body.modalidade) : "DESIGNADO";
  return { dados: { promotorAfastadoId, promotorCobridorId, modalidade, inicio, fim } };
}

export interface PromotorComFiltros {
  id: number;
  tipo: string;
  atuacao: string;
  varas: number[];
}

export interface FiltrosPromotores {
  tipo: string;
  atuacao: string;
  varas: number[];
}

export function filtrarPromotores<T extends PromotorComFiltros>(promotores: T[], filtros: FiltrosPromotores): T[] {
  return promotores.filter((promotor) => {
    if (filtros.tipo && promotor.tipo !== filtros.tipo) return false;
    if (filtros.atuacao && promotor.atuacao !== filtros.atuacao) return false;
    if (filtros.varas.length > 0 && promotor.varas.length > 0 && !filtros.varas.some((vara) => promotor.varas.includes(vara))) return false;
    return true;
  });
}

import { diaSemana, segundaDe } from "./datas";

export interface VagaInput {
  data: string;
  posicaoId: number;
  codigo: string;
  grupo: string;
  peso: number;
  ordem: number;
  prePromotorId?: number;
}

export interface RegraInput {
  tipo: string;
  diasCsv: string;
  gruposCsv: string;
}

export interface PromotorInput {
  id: number;
  apelido: string;
  tipo: string;
  atuacao: string;
  varas: number[];
  ativo: boolean;
  diasCustodia?: string[];
  regras?: RegraInput[];
  portarias: { inicio: string; fim: string; numero?: string | null }[];
  coberturas: { inicio: string; fim: string; varas: number[]; regras?: RegraInput[]; afastadoId?: number; atuaAfastado?: string; modalidade?: string; afastadoAuxiliar?: boolean }[];
  bloqueios: { posicaoId: number | null; data: string | null }[];
  cargo?: string | null;
  secretarioCoberto?: { inicio: string; fim: string }[];
  generico?: boolean;
}

/**
 * O limite de 1 audiência por semana pertence à FUNÇÃO de secretário:
 * - o secretário, sempre;
 * - o sub-secretário, apenas nos períodos em que o secretário está ausente (portaria).
 * O cobridor da portaria NÃO herda esse limite: faz as audiências do cargo coberto sem restrição semanal.
 */
export function limiteAudSemana(p: PromotorInput, data: string): boolean {
  if (p.cargo === "SECRETARIO") return true;
  if (p.cargo === "SUBSECRETARIO") {
    return (p.secretarioCoberto ?? []).some((c) => c.inicio <= data && data <= c.fim);
  }
  return false;
}

export interface Alocacao {
  data: string;
  posicaoId: number;
  promotorId: number | null;
  motivo?: string;
}

export interface ResultadoGeracao {
  alocacoes: Alocacao[];
  cargaPorGrupo: Map<number, Record<string, number>>;
  vagaEmBranco: number;
}

const W_RECENCIA = 0.6;

function varaDe(codigo: string): number | null {
  const m = /^(\d)'?$/.exec(codigo);
  return m ? Number(m[1]) : null;
}

function diaAnterior(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function diaSeguinte(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function atuaEm(p: { atuacao: string }, codigo: string): boolean {
  if (p.atuacao === "CUSTODIA") return codigo === "C";
  if (p.atuacao === "PLANTAO") return codigo === "P";
  if (p.atuacao === "CUSTODIA_PLANTAO") return codigo === "C" || codigo === "P";
  return true;
}

export function atuaNaVara(p: { varas?: number[] }, codigo: string): boolean {
  const vara = varaDe(codigo);
  if (vara === null) return true;
  if (!p.varas || p.varas.length === 0) return true;
  return p.varas.includes(vara);
}

export function coberturaAtiva(
  p: PromotorInput,
  codigo: string,
  data: string
): { inicio: string; fim: string; varas: number[]; regras?: RegraInput[]; afastadoId?: number; atuaAfastado?: string; modalidade?: string; afastadoAuxiliar?: boolean } | undefined {
  const m = /^(\d)('?)$/.exec(codigo);
  if (!m) return undefined;
  const vara = Number(m[1]);
  const isAux = m[2] === "'";
  for (const c of p.coberturas ?? []) {
    if (c.inicio <= data && data <= c.fim) {
      // A cobertura cobre apenas as posições do próprio cargo do afastado:
      // titular (N) ou auxiliar (N'), a depender do tipo dele.
      const auxEsperada = !!c.afastadoAuxiliar;
      if (auxEsperada !== isAux) continue;
      if (!c.varas || c.varas.length === 0 || c.varas.includes(vara)) return c;
    }
  }
  return undefined;
}

export function regraImpede(
  regras: RegraInput[] | undefined,
  grupo: string | undefined,
  diaSemanaNum: number
): boolean {
  if (!regras || !grupo) return false;
  for (const r of regras) {
    if (r.gruposCsv && !r.gruposCsv.split(",").includes(grupo)) continue;
    const dias = r.diasCsv.split(",").map(Number).filter((n) => !Number.isNaN(n));
    if (dias.length === 0) continue;
    if (r.tipo === "EXCETO") {
      if (dias.includes(diaSemanaNum)) return true;
    } else if (!dias.includes(diaSemanaNum)) return true;
  }
  return false;
}

export function estaDisponivel(
  p: PromotorInput,
  data: string,
  codigo: string,
  posicaoId?: number,
  grupo?: string
): boolean {
  if (!p.ativo) return false;
  const cob = coberturaAtiva(p, codigo, data);
  if (p.tipo !== "SUBSTITUTO") {
    // Cobrindo, o promotor age como o cargo coberto: atuação, varas e regras do afastado.
    if (!atuaEm({ atuacao: cob?.atuaAfastado ?? p.atuacao }, codigo)) return false;
    if (!atuaNaVara(p, codigo) && !cob) return false;
    if (regraImpede(cob ? cob.regras : p.regras, grupo, diaSemana(data))) return false;
  }
  // A portaria de afastamento não impede o lançamento manual de Custódia (posição C):
  // a oficialia pode manter o afastado nas custódias do período da portaria.
  if (codigo !== "C") {
    for (const pt of p.portarias ?? []) {
      if (pt.inicio <= data && data <= pt.fim) return false;
    }
  }
  for (const b of p.bloqueios) {
    if (posicaoId !== undefined && b.posicaoId !== null && b.posicaoId !== posicaoId) continue;
    if (b.data !== null && b.data !== data) continue;
    return false;
  }
  return true;
}

const TIPOS_NAO_CONCORREM = ["SUBSTITUTO", "AUXILIAR", "REGIONAL"];

export function gerarEscala(
  vagas: VagaInput[],
  promotores: PromotorInput[],
  pesos: Record<string, number>,
  cargaInicial: Map<number, Record<string, number>> = new Map()
): ResultadoGeracao {
  const disponiveis = promotores.filter((p) => p.ativo && !TIPOS_NAO_CONCORREM.includes(p.tipo));
  const preIds = new Set(vagas.map((v) => v.prePromotorId).filter((x): x is number => !!x));
  const mapeaveis = promotores.filter(
    (p) => p.ativo && (!TIPOS_NAO_CONCORREM.includes(p.tipo) || p.generico || preIds.has(p.id))
  );
  const cargaGrupo = new Map<number, Map<string, number>>();
  const designacoes = new Map<number, number>();
  const dataPorPromotor = new Map<number, Set<string>>();
  const varasPorDia = new Map<number, Map<string, number>>();
  const alocadas = new Map<string, number>();
  const audSemana = new Map<number, Map<string, number>>();

  const pesoDe = (grupo: string) => pesos[grupo] ?? 1;
  const cargaDe = (pid: number, grupo: string) => cargaGrupo.get(pid)!.get(grupo) ?? 0;
  const audNaSemana = (pid: number, data: string) => audSemana.get(pid)?.get(segundaDe(data)) ?? 0;
  const incAudSemana = (pid: number, data: string) => {
    const chave = segundaDe(data);
    const m = audSemana.get(pid) ?? new Map();
    m.set(chave, (m.get(chave) ?? 0) + 1);
    audSemana.set(pid, m);
  };
  const registrarVara = (pid: number, v: VagaInput) => {
    if (v.grupo !== "AUDIENCIAS") return;
    const vara = varaDe(v.codigo);
    if (vara === null) return;
    varasPorDia.get(pid)!.set(v.data, vara);
  };
  const mesmaVaraAdjacente = (p: PromotorInput, v: VagaInput) => {
    if (p.generico || v.grupo !== "AUDIENCIAS") return false;
    const vara = varaDe(v.codigo);
    if (vara === null) return false;
    const dias = varasPorDia.get(p.id)!;
    return dias.get(diaAnterior(v.data)) === vara || dias.get(diaSeguinte(v.data)) === vara;
  };

  for (const p of mapeaveis) {
    cargaGrupo.set(p.id, new Map(Object.entries(cargaInicial.get(p.id) ?? {})));
    designacoes.set(p.id, 0);
    dataPorPromotor.set(p.id, new Set());
    varasPorDia.set(p.id, new Map());
    audSemana.set(p.id, new Map());
    for (const dc of p.diasCustodia ?? []) dataPorPromotor.get(p.id)!.add(dc);
  }

  const preAlocadas = new Set<string>();
  for (const v of vagas) {
    if (!v.prePromotorId) continue;
    const key = `${v.data}|${v.posicaoId}`;
    const p = mapeaveis.find((x) => x.id === v.prePromotorId);
    if (!p) continue;
    // Genéricos podem acumular posições no mesmo dia (ex.: cobertura + auxiliar).
    if (!p.generico && dataPorPromotor.get(p.id)!.has(v.data)) continue;
    if (!estaDisponivel(p, v.data, v.codigo, v.posicaoId, v.grupo)) continue;
    alocadas.set(key, p.id);
    preAlocadas.add(key);
    if (v.grupo === "AUDIENCIAS") incAudSemana(p.id, v.data);
    registrarVara(p.id, v);
    cargaGrupo.get(p.id)!.set(v.grupo, cargaDe(p.id, v.grupo) + pesoDe(v.grupo));
    designacoes.set(p.id, designacoes.get(p.id)! + 1);
    dataPorPromotor.get(p.id)!.add(v.data);
  }

  function candidatos(v: VagaInput, relaxarMesmaVara = false): PromotorInput[] {
    return disponiveis.filter(
      (p) =>
        estaDisponivel(p, v.data, v.codigo, v.posicaoId, v.grupo) &&
        (p.generico || !dataPorPromotor.get(p.id)!.has(v.data)) &&
        !(v.grupo === "AUDIENCIAS" && limiteAudSemana(p, v.data) && audNaSemana(p.id, v.data) >= 1) &&
        (relaxarMesmaVara || !mesmaVaraAdjacente(p, v))
    );
  }

  function score(p: PromotorInput, v: VagaInput): number {
    let s = cargaDe(p.id, v.grupo);
    if (dataPorPromotor.get(p.id)!.has(diaAnterior(v.data))) s += W_RECENCIA;
    return s;
  }

  const ordenadas = [...vagas].sort((a, b) => {
    const ca = candidatos(a).length;
    const cb = candidatos(b).length;
    if (ca !== cb) return ca - cb;
    if (b.peso !== a.peso) return b.peso - a.peso;
    return a.ordem - b.ordem || a.data.localeCompare(b.data);
  });

  for (const v of ordenadas) {
    if (preAlocadas.has(`${v.data}|${v.posicaoId}`)) continue;
    let cands = candidatos(v);
    if (cands.length === 0 && v.grupo === "AUDIENCIAS") cands = candidatos(v, true);
    if (cands.length === 0) continue;
    let melhor = cands[0];
    let melhorScore = score(melhor, v);
    for (let i = 1; i < cands.length; i++) {
      const atual = cands[i];
      const repeteAtual = mesmaVaraAdjacente(atual, v);
      const repeteMelhor = mesmaVaraAdjacente(melhor, v);
      if (repeteAtual !== repeteMelhor) {
        if (!repeteAtual) {
          melhor = atual;
          melhorScore = score(atual, v);
        }
        continue;
      }
      const s = score(atual, v);
      const dAtual = designacoes.get(atual.id)!;
      const dMelhor = designacoes.get(melhor.id)!;
      if (
        s < melhorScore ||
        (s === melhorScore && dAtual < dMelhor) ||
        (s === melhorScore && dAtual === dMelhor && atual.apelido < melhor.apelido)
      ) {
        melhor = atual;
        melhorScore = s;
      }
    }
    alocadas.set(`${v.data}|${v.posicaoId}`, melhor.id);
    if (v.grupo === "AUDIENCIAS") incAudSemana(melhor.id, v.data);
    registrarVara(melhor.id, v);
    cargaGrupo.get(melhor.id)!.set(v.grupo, cargaDe(melhor.id, v.grupo) + pesoDe(v.grupo));
    designacoes.set(melhor.id, designacoes.get(melhor.id)! + 1);
    dataPorPromotor.get(melhor.id)!.add(v.data);
  }

  const alocacoes: Alocacao[] = vagas.map((v) => {
    const key = `${v.data}|${v.posicaoId}`;
    return {
      data: v.data,
      posicaoId: v.posicaoId,
      promotorId: alocadas.get(key) ?? null,
      motivo: alocadas.has(key) ? undefined : "Sem candidato disponível",
    };
  });

  const cargaPorGrupo = new Map<number, Record<string, number>>();
  for (const p of mapeaveis) {
    const rec: Record<string, number> = {};
    for (const [grupo, valor] of cargaGrupo.get(p.id)!) rec[grupo] = valor;
    cargaPorGrupo.set(p.id, rec);
  }

  return {
    alocacoes,
    cargaPorGrupo,
    vagaEmBranco: vagas.length - alocadas.size,
  };
}

export type Papel = "CHEFE" | "OFICIAL" | "PROMOTOR";

export interface TourPasso {
  alvo: string;
  titulo: string;
  descricao: string;
  papeis: Papel[];
}

export interface TourRota {
  rota: string;
  passos: TourPasso[];
}

const base = (rota: string, titulo: string, descricao: string, papeis: Papel[]): TourPasso => ({
  alvo: `[data-tour="${rota}-titulo"]`,
  titulo,
  descricao,
  papeis,
});

export const TOUR_POR_ROTA: TourRota[] = [
  {
    rota: "/",
    passos: [
      base("/", "Dashboard", "Visão geral do mês atual: atalhos para escala, carga e situação das audiências.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
    ],
  },
  {
    rota: "/escala",
    passos: [
      base("/escala", "Escala mensal", "A escala de audiências do mês. Navegue pelos meses e acompanhe o status (RASCUNHO, PRONTA, APROVADA, PUBLICADA).", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='escala-controles']", titulo: "Mês e ano", descricao: "Escolha o mês/ano para visualizar ou gerar a escala correspondente.", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
      { alvo: "[data-tour='escala-gerar']", titulo: "Gerar escala", descricao: "Cria o esqueleto do mês (dias e posições) para depois lançar Custódia e Trocas/Ajustes.", papeis: ["CHEFE"] },
      { alvo: "[data-tour='escala-gerar-desig']", titulo: "Gerar designações", descricao: "Preenche automaticamente as vagas restantes segundo regras, atuações e portarias.", papeis: ["CHEFE"] },
      { alvo: "[data-tour='escala-tabela']", titulo: "Tabela da escala", descricao: "Cada linha é uma posição; cada coluna, um dia útil. Células amarelas são Custódia (manual).", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
      { alvo: "[data-tour='escala-carga']", titulo: "Carga ponderada", descricao: "Distribuição da carga por promotor e grupo; saldo anterior acumula meses já escalados.", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
    ],
  },
  {
    rota: "/custodia",
    passos: [
      base("/custodia", "Custódia", "Lançamento manual de custódia por dia. Tem prioridade e é preservada ao regenerar a escala.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='custodia-form']", titulo: "Lançamento", descricao: "Escolha dia, posição e promotor para registrar a custódia.", papeis: ["CHEFE"] },
    ],
  },
  {
    rota: "/promotores",
    passos: [
      base("/promotores", "Promotores", "Cadastro dos promotores e suas atuações (titulares, auxiliares, regionais, substitutos e genéricos).", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='promotores-novo']", titulo: "Novo promotor", descricao: "Adiciona um promotor e configura tipo, atuação e vínculos.", papeis: ["CHEFE"] },
      { alvo: "[data-tour='promotores-lista']", titulo: "Lista", descricao: "Consulte os promotores ativos e suas configurações de atuação.", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
    ],
  },
  {
    rota: "/regras",
    passos: [
      base("/regras", "Regras", "Regras reutilizáveis por tipo de audiência e dia da semana, vinculáveis a vários promotores.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='regras-nova']", titulo: "Nova regra", descricao: "Cria uma regra de grupo, definindo os dias em que ela se aplica.", papeis: ["CHEFE"] },
      { alvo: "[data-tour='regras-lista']", titulo: "Lista de regras", descricao: "Veja as regras e a quais promotores estão vinculadas.", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
    ],
  },
  {
    rota: "/portarias",
    passos: [
      base("/portarias", "Portarias", "Portarias de cobertura: quem cobre age como o cargo coberto e herda as audiências do período.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='portarias-nova']", titulo: "Nova portaria", descricao: "Registra afastamento e cobertura; o afastado sai da escala no período.", papeis: ["CHEFE"] },
      { alvo: "[data-tour='portarias-lista']", titulo: "Lista", descricao: "Consulte as portarias ativas e os cobertores.", papeis: ["CHEFE", "OFICIAL", "PROMOTOR"] },
    ],
  },
  {
    rota: "/trocas",
    passos: [
      base("/trocas", "Trocas / Ajustes", "Ajustes manuais por dia, posição e promotor que assume — uma máscara sobre a escala original.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='trocas-lancar']", titulo: "Lançar ajuste", descricao: "Substitui uma designação ou preenche uma posição originalmente vaga.", papeis: ["CHEFE", "OFICIAL"] },
      { alvo: "[data-tour='trocas-lista']", titulo: "Lista de ajustes", descricao: "Acompanhe os ajustes lançados e exclua os que tiver permissão.", papeis: ["CHEFE", "OFICIAL"] },
    ],
  },
  {
    rota: "/feriados",
    passos: [
      base("/feriados", "Feriados", "Datas em que não há audiências na comarca.", ["CHEFE", "OFICIAL"]),
      { alvo: "[data-tour='feriados-novo']", titulo: "Novo feriado", descricao: "Cadastra um feriado para o cálculo da escala.", papeis: ["CHEFE"] },
    ],
  },
  {
    rota: "/grade",
    passos: [
      base("/grade", "Posições", "Configuração da grade: quais posições funcionam em cada dia da semana.", ["CHEFE", "OFICIAL"]),
      { alvo: "[data-tour='grade-grade']", titulo: "Grade da semana", descricao: "Ligue/desligue posições por dia da semana.", papeis: ["CHEFE"] },
    ],
  },
  {
    rota: "/excecoes",
    passos: [
      base("/excecoes", "Exceções", "Exceções pontuais por mês: ativa ou desativa uma posição em uma data específica.", ["CHEFE", "OFICIAL"]),
      { alvo: "[data-tour='excecoes-lista']", titulo: "Lista de exceções", descricao: "Consulte as exceções cadastradas para o mês.", papeis: ["CHEFE", "OFICIAL"] },
    ],
  },
  {
    rota: "/configuracoes",
    passos: [
      base("/configuracoes", "Configurações", "Exportar/importar configurações e gerenciar o reset e a limpeza de escalas.", ["CHEFE", "OFICIAL", "PROMOTOR"]),
      { alvo: "[data-tour='configuracoes-acoes']", titulo: "Ações", descricao: "Exporte as configurações para Excel ou importe de um arquivo.", papeis: ["CHEFE"] },
    ],
  },
  {
    rota: "/usuarios",
    passos: [
      base("/usuarios", "Usuários e acessos", "Gerencie os usuários e os papéis de acesso (CHEFE, OFICIAL, PROMOTOR).", ["CHEFE"]),
      { alvo: "[data-tour='usuarios-lista']", titulo: "Lista de usuários", descricao: "Veja os usuários e os vínculos de cada um.", papeis: ["CHEFE"] },
    ],
  },
];

export function passosDaRota(rota: string, papel: Papel): TourPasso[] {
  const definicao = TOUR_POR_ROTA.find((r) => r.rota === rota);
  if (!definicao) return [];
  return definicao.passos.filter((p) => p.papeis.includes(papel));
}

export function proximoIndice(
  passos: TourPasso[],
  atual: number,
  existe: (alvo: string) => boolean,
  avancar: boolean
): number | null {
  if (passos.length === 0) return null;
  const passo = avancar ? 1 : -1;
  let i = atual;
  for (let k = 0; k < passos.length; k++) {
    i = (i + passo + passos.length) % passos.length;
    if (i === atual && k > 0) break;
    if (existe(passos[i].alvo)) return i;
  }
  return null;
}

export function chaveVisita(email: string): string {
  return `tour:${email}`;
}

export function jaVisitou(storage: Pick<Storage, "getItem">, email: string): boolean {
  return storage.getItem(chaveVisita(email)) === "1";
}

export function marcarVisitado(storage: Pick<Storage, "setItem">, email: string): void {
  storage.setItem(chaveVisita(email), "1");
}

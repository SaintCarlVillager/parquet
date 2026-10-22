import ExcelJS from "exceljs";

export const LIMITE_EXCEL_BYTES = 5 * 1024 * 1024;
export const LIMITE_EXCEL_ABAS = 10;
export const LIMITE_EXCEL_LINHAS = 5000;
export const LIMITE_EXCEL_COLUNAS = 50;
export const LIMITE_EXCEL_CELULAS = 250000;
const LIMITE_EXCEL_TEMPO_MS = 15000;

export class ExcelLimiteError extends Error {
  status = 413;
}

export async function carregarWorkbookLimitado(arquivo: File): Promise<ExcelJS.Workbook> {
  const nome = arquivo.name.toLowerCase();
  if (!nome.endsWith(".xlsx") && !nome.endsWith(".xlsm")) {
    throw new Error("Use um arquivo Excel .xlsx ou .xlsm");
  }
  if (arquivo.size > LIMITE_EXCEL_BYTES) {
    throw new ExcelLimiteError("Arquivo Excel excede o limite de 5 MB");
  }
  const wb = new ExcelJS.Workbook();
  const dados = await arquivo.arrayBuffer();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      wb.xlsx.load(dados),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ExcelLimiteError("Processamento do Excel excedeu o tempo limite")), LIMITE_EXCEL_TEMPO_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (wb.worksheets.length > LIMITE_EXCEL_ABAS) {
    throw new ExcelLimiteError("Arquivo Excel excede o limite de abas");
  }
  let celulas = 0;
  for (const ws of wb.worksheets) {
    const linhas = ws.rowCount ?? 0;
    const colunas = ws.columnCount ?? 0;
    if (linhas > LIMITE_EXCEL_LINHAS || colunas > LIMITE_EXCEL_COLUNAS) {
      throw new ExcelLimiteError("Arquivo Excel excede o limite de linhas ou colunas");
    }
    celulas += linhas * colunas;
  }
  if (celulas > LIMITE_EXCEL_CELULAS) {
    throw new ExcelLimiteError("Arquivo Excel excede o limite de celulas");
  }
  return wb;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function normalizarChave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// ExcelJS monta as datas de células em UTC (meia-noite UTC); getters UTC evitam deslocamento de fuso.
export function isoDeDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function textoDaCelula(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isoDeDateUTC(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const o = v as { richText?: { text: string }[]; result?: unknown; text?: unknown };
  if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
  if (o.result !== undefined) return textoDaCelula(o.result);
  if (o.text !== undefined && o.text !== null) return textoDaCelula(o.text);
  return "";
}

export function parseDataISO(v: unknown): string | null {
  if (v instanceof Date) return isoDeDateUTC(v);
  const s = textoDaCelula(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (m) {
    const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${ano}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
  }
  return null;
}

export function parseBooleano(v: unknown): boolean | null {
  const s = normalizarChave(textoDaCelula(v));
  if (!s) return null;
  if (["SIM", "S", "VERDADEIRO", "TRUE", "1", "X", "YES", "Y", "OK"].includes(s)) return true;
  if (["NAO", "N", "FALSO", "FALSE", "0", "NO"].includes(s)) return false;
  return null;
}

// null = coluna vazia (manter valor atual); [] = limpar (atuar em todas)
export function parseVaras(v: unknown): number[] | null {
  const s = textoDaCelula(v);
  if (!s) return null;
  if (normalizarChave(s).startsWith("TODA")) return [];
  const nums = s
    .split(/[,;\s/]+/)
    .map((t) => Number(t.replace(/\D/g, "")))
    .filter((n) => n >= 1 && n <= 6);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function parseTipo(v: unknown, padrao: string): string {
  const s = normalizarChave(textoDaCelula(v));
  if (!s) return padrao;
  if (s.includes("SUBSTITUT")) return "SUBSTITUTO";
  if (s.includes("REGIONAL")) return "REGIONAL";
  if (s.includes("AUXILIAR")) return "AUXILIAR";
  if (s.includes("TITULAR")) return "TITULAR";
  return padrao;
}

export function parseAtuacao(v: unknown, padrao: string): string {
  const s = normalizarChave(textoDaCelula(v));
  if (!s) return padrao;
  if (s.includes("CUSTODIA")) return s.includes("PLANTAO") ? "CUSTODIA_PLANTAO" : "CUSTODIA";
  if (s.includes("AUXILIAR")) return "TODAS";
  if (s.includes("PLANTAO")) return "PLANTAO";
  if (s.includes("VARA") || s.startsWith("TODA")) return "TODAS";
  if (["TODAS", "CUSTODIA_PLANTAO", "CUSTODIA", "PLANTAO"].includes(s)) return s;
  return padrao;
}

export function parseModalidade(v: unknown): string {
  const s = normalizarChave(textoDaCelula(v));
  if (s.includes("ACUMULACAO")) return "ACUMULACAO";
  if (s.includes("AUXILIO")) return "AUXILIO";
  return "DESIGNADO";
}

export interface LinhaAba {
  numero: number;
  valores: Record<string, unknown>;
}
export interface AbaLida {
  headers: string[];
  linhas: LinhaAba[];
}

// Lê a aba procurando a linha de cabeçalho (com todos os tokens) nas ~25 primeiras linhas.
export function lerAba(ws: ExcelJS.Worksheet, obrigatorios: string[]): AbaLida | null {
  const colCount = ws.columnCount ?? 0;
  let linhaCabecalho = -1;
  let headers: string[] = [];
  const ateLinha = Math.min(ws.rowCount ?? 0, 25);
  for (let r = 1; r <= ateLinha; r++) {
    const vals: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      vals.push(normalizarChave(textoDaCelula(ws.getRow(r).getCell(c).value)));
    }
    if (obrigatorios.every((tok) => vals.some((h) => h && h.includes(tok)))) {
      linhaCabecalho = r;
      headers = vals;
      break;
    }
  }
  if (linhaCabecalho < 0) return null;
  const linhas: LinhaAba[] = [];
  for (let r = linhaCabecalho + 1; r <= (ws.rowCount ?? 0); r++) {
    const row = ws.getRow(r);
    const valores: Record<string, unknown> = {};
    let temConteudo = false;
    for (let c = 1; c <= colCount; c++) {
      const valor = row.getCell(c).value;
      if (textoDaCelula(valor) !== "") temConteudo = true;
      valores[headers[c - 1]] = valor;
    }
    if (temConteudo) linhas.push({ numero: r, valores });
  }
  return { headers, linhas };
}

// Escolhe a coluna mais específica que contém o token, ignorando as que contêm algo a evitar.
export function colunaDe(headers: string[], token: string, evita: string[] = []): string | null {
  const candidatos = headers.filter((h) => h && h.includes(token) && !evita.some((e) => h.includes(e)));
  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) => a.length - b.length)[0];
}

export function abaDaPlanilha(wb: ExcelJS.Workbook, tokens: string[]): ExcelJS.Worksheet | null {
  for (const ws of wb.worksheets) {
    const nome = normalizarChave(ws.name);
    if (tokens.some((t) => nome.includes(t))) return ws;
  }
  return null;
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { inserirPortarias, type LinhaPortaria } from "@/lib/escritasAtomicas";
import {
  abaDaPlanilha,
  colunaDe,
  lerAba,
  normalizarChave,
  parseDataISO,
  parseModalidade,
  textoDaCelula,
  carregarWorkbookLimitado,
  ExcelLimiteError,
  LIMITE_EXCEL_BYTES,
} from "@/lib/excelUtil";
import { withApiError } from "@/lib/errosApi";

export const runtime = "nodejs";
export const maxDuration = 20;

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > LIMITE_EXCEL_BYTES + 65536) {
    return NextResponse.json({ erro: "Arquivo Excel excede o limite de 5 MB" }, { status: 413 });
  }
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Envie o arquivo Excel (.xlsx)" }, { status: 400 });
  }
  let wb: Awaited<ReturnType<typeof carregarWorkbookLimitado>>;
  try {
    wb = await carregarWorkbookLimitado(arquivo);
  } catch (e) {
    if (e instanceof ExcelLimiteError) return NextResponse.json({ erro: e.message }, { status: e.status });
    return NextResponse.json({ erro: "Arquivo Excel inválido" }, { status: 400 });
  }
  const ws = abaDaPlanilha(wb, ["AFASTAMENTO", "PORTARIA", "COBERTURA"]);
  if (!ws) {
    return NextResponse.json(
      { erro: "Não encontrei a aba \"Afastamentos\" no arquivo. Use o Excel gerado pelo botão \"Exportar Excel\"." },
      { status: 400 }
    );
  }
  const aba = lerAba(ws, ["AFASTADO", "INICIO", "FIM"]);
  if (!aba) {
    return NextResponse.json(
      { erro: "A aba \"Afastamentos\" não tem as colunas Afastado, Início e Fim." },
      { status: 400 }
    );
  }

  const colNumero = colunaDe(aba.headers, "PORTARIA");
  const colInicio = colunaDe(aba.headers, "INICIO");
  const colFim = colunaDe(aba.headers, "FIM");
  const colAfastado = colunaDe(aba.headers, "AFASTADO", ["NOME"]);
  const colCobridor = colunaDe(aba.headers, "COBR", ["NOME"]);
  const colModalidade = colunaDe(aba.headers, "MODALIDADE");
  const colObs = colunaDe(aba.headers, "OBSERVACAO");
  if (!colAfastado || !colInicio || !colFim) {
    return NextResponse.json({ erro: "Colunas Afastado, Início e Fim são obrigatórias." }, { status: 400 });
  }

  const promotores = await db.promotor.findMany({ select: { id: true, apelido: true } });
  const idPorApelido = new Map(promotores.map((p) => [normalizarChave(p.apelido), p.id]));
  const existentes = await db.portaria.findMany({
    select: { promotorAfastadoId: true, promotorCobridorId: true, inicio: true, fim: true, modalidade: true },
  });
  const chaves = new Set(
    existentes.map((p) => [p.promotorAfastadoId, p.promotorCobridorId ?? 0, p.inicio, p.fim, p.modalidade].join("|"))
  );

  let criados = 0;
  let ignorados = 0;
  const erros: { linha: number; erro: string }[] = [];
  const novas: LinhaPortaria[] = [];

  for (const l of aba.linhas) {
    const v = l.valores;
    const afTxt = textoDaCelula(v[colAfastado]);
    const iniTxt = textoDaCelula(v[colInicio]);
    if (!afTxt && !iniTxt) continue;
    const afId = idPorApelido.get(normalizarChave(afTxt));
    if (!afId) {
      erros.push({ linha: l.numero, erro: `Promotor afastado "${afTxt}" não encontrado (use o apelido)` });
      continue;
    }
    const cobTxt = colCobridor ? textoDaCelula(v[colCobridor]) : "";
    let cobId: number | null = null;
    if (cobTxt) {
      cobId = idPorApelido.get(normalizarChave(cobTxt)) ?? null;
      if (cobId === null) {
        erros.push({ linha: l.numero, erro: `Quem cobre "${cobTxt}" não encontrado (use o apelido)` });
        continue;
      }
    }
    const inicio = parseDataISO(v[colInicio]);
    const fim = parseDataISO(v[colFim]);
    if (!inicio || !fim) {
      erros.push({ linha: l.numero, erro: "Datas inválidas (use AAAA-MM-DD ou DD/MM/AAAA)" });
      continue;
    }
    if (inicio > fim) {
      erros.push({ linha: l.numero, erro: "Data de início posterior à data de fim" });
      continue;
    }
    if (cobId === afId) {
      erros.push({ linha: l.numero, erro: "Quem cobre não pode ser o próprio afastado" });
      continue;
    }
    const modalidade = parseModalidade(colModalidade ? v[colModalidade] : "");
    const chave = [afId, cobId ?? 0, inicio, fim, modalidade].join("|");
    if (chaves.has(chave)) {
      ignorados++;
      continue;
    }
    novas.push({
      numero: (colNumero ? textoDaCelula(v[colNumero]) : "") || null,
      promotorAfastadoId: afId,
      promotorCobridorId: cobId,
      modalidade,
      inicio,
      fim,
      observacao: (colObs ? textoDaCelula(v[colObs]) : "") || null,
    });
    chaves.add(chave);
  }

  if (erros.length) return NextResponse.json({ ok: false, criados: 0, ignorados, erros }, { status: 400 });
  await inserirPortarias(novas);
  criados = novas.length;

  return NextResponse.json({ ok: true, criados, ignorados, erros });
}

export const POST = withApiError("portarias.import.POST", postHandler);

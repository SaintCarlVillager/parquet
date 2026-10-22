import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth";
import { publicarPromotores, type LinhaPromotorImportacao } from "@/lib/escritasAtomicas";
import {
  abaDaPlanilha,
  colunaDe,
  lerAba,
  normalizarChave,
  parseAtuacao,
  parseBooleano,
  parseTipo,
  parseVaras,
  textoDaCelula,
  carregarWorkbookLimitado,
  ExcelLimiteError,
  LIMITE_EXCEL_BYTES,
} from "@/lib/excelUtil";
import { withApiError } from "@/lib/errosApi";

export const runtime = "nodejs";
export const maxDuration = 20;

interface PromotorVivo {
  id: number;
  apelido: string;
  nome: string;
  email: string | null;
  tipo: string;
  atuacao: string;
  ativo: boolean;
  generico: boolean;
  observacoes: string | null;
  varas: { vara: number }[];
}

async function postHandler(req: Request) {
  const g = await exigir(req, ["CHEFE"]);
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
  const ws = abaDaPlanilha(wb, ["PROMOTOR"]);
  if (!ws) {
    return NextResponse.json(
      { erro: "Não encontrei a aba \"Promotores\" no arquivo. Use o Excel gerado pelo botão \"Exportar Excel\"." },
      { status: 400 }
    );
  }
  const aba = lerAba(ws, ["APELIDO", "NOME"]);
  if (!aba) {
    return NextResponse.json({ erro: "A aba \"Promotores\" não tem as colunas Apelido e Nome." }, { status: 400 });
  }

  const colApelido = colunaDe(aba.headers, "APELIDO");
  const colNome = colunaDe(aba.headers, "NOME", ["APELIDO"]);
  const colEmail = colunaDe(aba.headers, "EMAIL");
  const colTipo = colunaDe(aba.headers, "TIPO");
  const colAtuacao = colunaDe(aba.headers, "ATUACAO");
  const colVaras = colunaDe(aba.headers, "VARA");
  const colAtivo = colunaDe(aba.headers, "ATIVO");
  const colGenerico = colunaDe(aba.headers, "GENERICO");
  const colObservacoes = colunaDe(aba.headers, "OBSERVACOES");
  const colCargo = colunaDe(aba.headers, "CARGO");
  if (!colApelido || !colNome) {
    return NextResponse.json({ erro: "Colunas Apelido e Nome são obrigatórias." }, { status: 400 });
  }

  const existentes = await db.promotor.findMany({ include: { varas: true } });
  const porApelido = new Map<string, PromotorVivo>();
  for (const p of existentes) {
    porApelido.set(normalizarChave(p.apelido), {
      id: p.id,
      apelido: p.apelido,
      nome: p.nome,
      email: p.email,
      tipo: p.tipo,
      atuacao: p.atuacao,
      ativo: p.ativo,
      generico: p.generico,
      observacoes: p.observacoes,
      varas: p.varas.map((v) => ({ vara: v.vara })),
    });
  }

  let criados = 0;
  let atualizados = 0;
  const erros: { linha: number; erro: string }[] = [];
  const cargosClaim: { cargo: string; apelido: string; linha: number }[] = [];

  for (const l of aba.linhas) {
    const v = l.valores;
    const apelido = textoDaCelula(v[colApelido]);
    const nome = textoDaCelula(v[colNome]);
    if (!apelido && !nome) continue;
    if (!apelido || !nome) {
      erros.push({ linha: l.numero, erro: "Informe apelido e nome" });
      continue;
    }
    const atual = porApelido.get(normalizarChave(apelido)) ?? null;
    const tipo = parseTipo(colTipo ? v[colTipo] : "", atual?.tipo ?? "TITULAR");
    const atuacao = parseAtuacao(colAtuacao ? v[colAtuacao] : "", atual?.atuacao ?? "TODAS");
    const ativo = (colAtivo ? parseBooleano(v[colAtivo]) : null) ?? atual?.ativo ?? true;
    const generico = (colGenerico ? parseBooleano(v[colGenerico]) : null) ?? atual?.generico ?? false;
    const email = (colEmail ? textoDaCelula(v[colEmail]) : "") || null;
    const varas = colVaras ? parseVaras(v[colVaras]) : null;
    const observacoes = colObservacoes ? textoDaCelula(v[colObservacoes]) : atual?.observacoes ?? null;
    if (observacoes !== null && observacoes.length > 2000) {
      erros.push({ linha: l.numero, erro: "Observações excedem 2.000 caracteres" });
      continue;
    }
    const cargoTxt = colCargo ? textoDaCelula(v[colCargo]) : "";
    if (cargoTxt) {
      cargosClaim.push({
        cargo: normalizarChave(cargoTxt).includes("SUB") ? "SUBSECRETARIO" : "SECRETARIO",
        apelido,
        linha: l.numero,
      });
    }

    if (atual) {
      const varasAtuais = atual.varas.map((x) => x.vara).sort((a, b) => a - b);
      const mudouCampos =
        atual.nome !== nome ||
        (atual.email ?? null) !== email ||
        atual.tipo !== tipo ||
        atual.atuacao !== atuacao ||
        atual.ativo !== ativo ||
        atual.generico !== generico ||
        atual.observacoes !== (observacoes || null) ||
        atual.apelido !== apelido;
      const mudouVaras = varas !== null && varas.join(",") !== varasAtuais.join(",");
      if (mudouCampos || mudouVaras) {
        porApelido.set(normalizarChave(apelido), {
          ...atual,
          apelido,
          nome,
          email,
          tipo,
          atuacao,
          ativo,
          generico,
          observacoes: observacoes || null,
          varas: mudouVaras && varas ? varas.map((x) => ({ vara: x })) : atual.varas,
        });
        atualizados++;
      }
    } else {
      const idTemporario = -criados - 1;
      porApelido.set(normalizarChave(apelido), {
        id: idTemporario,
        apelido,
        nome,
        email,
        tipo,
        atuacao,
        ativo,
        generico,
        observacoes: observacoes || null,
        varas: (varas ?? []).map((x) => ({ vara: x })),
      });
      criados++;
    }
  }

  let cargosAtualizados = 0;
  const destino: Record<string, number | null> = { SECRETARIO: null, SUBSECRETARIO: null };
  if (cargosClaim.length) {
    const atuais = await db.cargoAdministrativo.findMany();
    for (const c of cargosClaim) {
      const p = porApelido.get(normalizarChave(c.apelido));
      if (!p) {
        erros.push({ linha: c.linha, erro: `Cargo: promotor "${c.apelido}" não encontrado` });
        continue;
      }
      if (!p.ativo) {
        erros.push({ linha: c.linha, erro: `${p.apelido} está inativo e não pode assumir cargo administrativo` });
        continue;
      }
      if (destino[c.cargo] !== null && destino[c.cargo] !== p.id) {
        erros.push({ linha: c.linha, erro: "O mesmo cargo administrativo foi indicado para promotores diferentes" });
        continue;
      }
      destino[c.cargo] = p.id;
    }
    const final: Record<string, number | null> = {
      SECRETARIO:
        destino.SECRETARIO ?? atuais.find((x) => x.cargo === "SECRETARIO")?.promotorId ?? null,
      SUBSECRETARIO:
        destino.SUBSECRETARIO ?? atuais.find((x) => x.cargo === "SUBSECRETARIO")?.promotorId ?? null,
    };
    if (final.SECRETARIO && final.SECRETARIO === final.SUBSECRETARIO) {
      erros.push({ linha: 0, erro: "O mesmo promotor não pode ocupar os dois cargos administrativos" });
    } else {
      const atualDe = new Map(atuais.map((x) => [x.cargo, x.promotorId]));
      for (const cargo of ["SECRETARIO", "SUBSECRETARIO"] as const) {
        if (destino[cargo] === null) continue;
        if (atualDe.get(cargo) === destino[cargo]) continue;
        cargosAtualizados++;
      }
    }
  }

  if (erros.length) return NextResponse.json({ ok: false, criados: 0, atualizados: 0, cargosAtualizados: 0, erros }, { status: 400 });

  const cargosParaPublicar: { cargo: string; apelido: string }[] = [];
  for (const cargo of ["SECRETARIO", "SUBSECRETARIO"] as const) {
    if (destino[cargo] === null) continue;
    const promotor = [...porApelido.values()].find((p) => p.id === destino[cargo]);
    if (promotor) cargosParaPublicar.push({ cargo, apelido: promotor.apelido });
  }
  const promotoresStaged = [...new Map([...porApelido.values()].map((p) => [p.id, p])).values()];
  const linhas: LinhaPromotorImportacao[] = promotoresStaged.map((p) => ({
    id: p.id > 0 ? p.id : null,
    apelido: p.apelido,
    nome: p.nome,
    email: p.email,
    tipo: p.tipo,
    atuacao: p.atuacao,
    ativo: p.ativo,
    generico: p.generico,
    observacoes: p.observacoes,
    varas: p.varas.map((v) => v.vara),
  }));
  await publicarPromotores(linhas, cargosParaPublicar);

  return NextResponse.json({ ok: true, criados, atualizados, cargosAtualizados, erros });
}

export const POST = withApiError("promotores.import.POST", postHandler);

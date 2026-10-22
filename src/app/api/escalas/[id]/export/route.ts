import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { semanasDoMes, parseISODate, MESES } from "@/lib/datas";
import { TODOS, exigir } from "@/lib/auth";
import { inteiroPositivo } from "@/lib/validacao";
import { aplicarTrocas } from "@/lib/trocas";
import { cargaAnterior } from "@/lib/carga";
import { withApiError } from "@/lib/errosApi";

export const runtime = "nodejs";

const ABREV = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];
const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const amarelo: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const cinza: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };

export const dynamic = "force-dynamic";

async function getHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(_req, TODOS);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const escalaId = inteiroPositivo(id);
  if (!escalaId) return new Response(JSON.stringify({ erro: "Escala invalida" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const escala = await db.escala.findUnique({
    where: { id: escalaId },
    include: {
      designacoes: { include: { posicao: true, promotor: true } },
    },
  });
  if (!escala) return new Response("Escala não encontrada", { status: 404 });

  const trocas = await db.troca.findMany({ where: { data: { gte: `${escala.ano}-${String(escala.mes).padStart(2, "0")}-01`, lt: `${escala.mes === 12 ? escala.ano + 1 : escala.ano}-${String(escala.mes === 12 ? 1 : escala.mes + 1).padStart(2, "0")}-01` } }, include: { promotorOrigem: true, promotorDestino: true } });
  const mascara = aplicarTrocas(escala.designacoes, trocas);
  const destinoPorId = new Map(trocas.map((t) => [t.promotorDestinoId, t.promotorDestino]));
  const origemPorChave = new Map(trocas.filter((t) => t.promotorOrigem).map((t) => [`${t.data}|${t.promotorOrigemId}`, t.promotorOrigem!.apelido]));
  const designacoesFinais = mascara.map((d) => ({
    ...d,
    promotor: d.origem === "TROCA" ? destinoPorId.get(d.promotorId ?? -1) ?? null : d.promotor,
    trocaCom: d.trocaOrigemId ? origemPorChave.get(`${d.data}|${d.trocaOrigemId}`) ?? null : d.origem === "TROCA" ? "vaga sem candidato" : null,
  }));

  const porChave = new Map(
    designacoesFinais.map((d) => [`${d.data}|${d.posicaoId}`, d])
  );
  const posicoes = [...escala.designacoes]
    .map((d) => d.posicao)
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => a.ordem - b.ordem);

  const varasRows = await db.promotorVara.findMany();
  const portariasRows = await db.portaria.findMany({
    include: { promotorAfastado: { select: { apelido: true } } },
  });
  const tiposRows = await db.promotor.findMany({ select: { id: true, tipo: true, generico: true } });
  const tipoPorId = new Map(tiposRows.map((p) => [p.id, p.tipo]));
  const genericos = new Set(tiposRows.filter((p) => p.generico).map((p) => p.id));
  const varasPorId = new Map<number, number[]>();
  for (const v of varasRows) {
    const lista = varasPorId.get(v.promotorId) ?? [];
    lista.push(v.vara);
    varasPorId.set(v.promotorId, lista);
  }
  const coberturasPorCobridor = new Map<
    number,
    { inicio: string; fim: string; varas: number[]; afastadoApelido: string; afastadoId: number; modalidade: string; afastadoAuxiliar: boolean }[]
  >();
  const afastamentosPorAfastado = new Map<number, { inicio: string; fim: string; numero: string | null }[]>();
  for (const pt of portariasRows) {
    if (pt.promotorCobridorId) {
      const lista = coberturasPorCobridor.get(pt.promotorCobridorId) ?? [];
      lista.push({
        inicio: pt.inicio,
        fim: pt.fim,
        varas: varasPorId.get(pt.promotorAfastadoId) ?? [],
        afastadoApelido: pt.promotorAfastado.apelido,
        afastadoId: pt.promotorAfastadoId,
        modalidade: pt.modalidade,
        afastadoAuxiliar: (tipoPorId.get(pt.promotorAfastadoId) ?? "TITULAR") === "AUXILIAR",
      });
      coberturasPorCobridor.set(pt.promotorCobridorId, lista);
    }
    const afastamentos = afastamentosPorAfastado.get(pt.promotorAfastadoId) ?? [];
    afastamentos.push({ inicio: pt.inicio, fim: pt.fim, numero: pt.numero });
    afastamentosPorAfastado.set(pt.promotorAfastadoId, afastamentos);
  }
  const ROTULO_COBERTURA: Record<string, string> = {
    DESIGNADO: "designado para",
    ACUMULACAO: "acumulando",
    AUXILIO: "auxiliando",
  };
  const cobrindoDe = (promotorId: number, data: string, codigo: string) => {
    const m = /^(\d)('?)$/.exec(codigo);
    if (!m) return null;
    const vara = Number(m[1]);
    const isAux = m[2] === "'";
    for (const c of coberturasPorCobridor.get(promotorId) ?? []) {
      if (c.inicio <= data && data <= c.fim && c.afastadoAuxiliar === isAux && (c.varas.length === 0 || c.varas.includes(vara))) {
        return c;
      }
    }
    return null;
  };
  const rotuloCustodiaExport = (promotorId: number, data: string, codigo: string) => {
    if (codigo !== "C") return null;
    const afast = (afastamentosPorAfastado.get(promotorId) ?? []).find(
      (pt) => pt.inicio <= data && data <= pt.fim
    );
    if (afast) return `afastado (portaria ${afast.numero ? `Nº ${afast.numero}` : "sem nº"})`;
    const cob = (coberturasPorCobridor.get(promotorId) ?? []).find(
      (c) => c.inicio <= data && data <= c.fim
    );
    if (cob) return `${ROTULO_COBERTURA[cob.modalidade] ?? "cobrindo"} ${cob.afastadoApelido}`;
    return null;
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Escala", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 10;
  for (let c = 2; c <= 6; c++) ws.getColumn(c).width = 22;

  let r = 1;
  const titulo = ws.getCell(r, 1);
  titulo.value = `ESCALA DE AUDIÊNCIAS - ${MESES[escala.mes - 1].toUpperCase()}/${escala.ano}`;
  titulo.font = { bold: true, size: 14, underline: true };
  r += 2;

  for (const semana of semanasDoMes(escala.ano, escala.mes)) {
    const diasUteis = semana.slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const d = parseISODate(diasUteis[i]);
      const noMes = d.getMonth() + 1 === escala.mes && d.getFullYear() === escala.ano;
      const cell = ws.getCell(r, i + 2);
      cell.value = noMes ? ABREV[i] : "";
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = cinza;
      cell.border = borda;
    }
    r++;
    for (let i = 0; i < 5; i++) {
      const d = parseISODate(diasUteis[i]);
      const noMes = d.getMonth() + 1 === escala.mes && d.getFullYear() === escala.ano;
      const cell = ws.getCell(r, i + 2);
      cell.value = noMes ? d.getDate() : "";
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = cinza;
      cell.border = borda;
    }
    r++;
    for (const pos of posicoes) {
      const label = ws.getCell(r, 1);
      label.value = pos.codigo;
      label.font = { bold: true };
      label.alignment = { horizontal: "center", vertical: "middle" };
      label.border = borda;
      if (pos.codigo === "C") label.fill = amarelo;
      for (let i = 0; i < 5; i++) {
        const des = porChave.get(`${diasUteis[i]}|${pos.id}`);
        const cell = ws.getCell(r, i + 2);
        if (des?.promotor && des.promotorId !== null) {
          const cob = cobrindoDe(des.promotorId, des.data, pos.codigo);
          const rotuloC = rotuloCustodiaExport(des.promotorId, des.data, pos.codigo);
          const richText: ExcelJS.RichText[] = [
            { font: { bold: true, size: 10 }, text: des.promotor.apelido },
            { font: { size: 7, color: { argb: "FF6B7280" } }, text: `\n${des.promotor.nome}` },
          ];
           if (cob) {
            richText.push({
              font: { size: 7, italic: true, bold: true, color: { argb: "FF854D0E" } },
              text: `\n${ROTULO_COBERTURA[cob.modalidade] ?? "cobrindo"} ${cob.afastadoApelido}`,
            });
          } else if (rotuloC) {
            richText.push({
              font: { size: 7, italic: true, bold: true, color: { argb: "FF854D0E" } },
              text: `\n${rotuloC}`,
            });
          } else if (genericos.has(des.promotorId) && /^\d'$/.test(pos.codigo)) {
            richText.push({
              font: { size: 7, italic: true, bold: true, color: { argb: "FF166534" } },
              text: "\najudando na auxiliar",
            });
          }
          if (des.trocaCom) {
            richText.push({
              font: { size: 7, italic: true, bold: true, color: { argb: "FF991B1B" } },
              text: des.trocaCom === "vaga sem candidato" ? "\najuste de vaga" : `\ntrocou com ${des.trocaCom}`,
            });
          }
          cell.value = { richText };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        } else {
          cell.value = "";
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
        cell.border = borda;
        if (pos.codigo === "C") cell.fill = amarelo;
      }
      r++;
    }
    r++;
  }

  const resumo = wb.addWorksheet("Resumo");
  const gruposDb = await db.grupoCarga.findMany({ orderBy: { grupo: "asc" } });
  const pesoDe = new Map(gruposDb.map((g) => [g.grupo, g.peso]));
  const promotoresCarga = await db.promotor.findMany({ include: { portariasCobridor: true } });
  const saldoAnterior = await cargaAnterior(
    escala.ano,
    escala.mes,
    promotoresCarga,
    Object.fromEntries(gruposDb.map((g) => [g.grupo, g.peso]))
  );
  resumo.columns = [
    { header: "Promotor", key: "nome", width: 16 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Nome completo", key: "nomeCompleto", width: 36 },
    ...gruposDb.map((g) => ({ header: `${g.nome} (peso ${g.peso})`, key: `g${g.grupo}`, width: 18 })),
    { header: "Saldo anterior", key: "anterior", width: 16 },
    { header: "Carga intramês", key: "total", width: 16 },
    { header: "Carga acumulada", key: "acumulado", width: 16 },
  ];
  resumo.getRow(1).font = { bold: true };
  const carga = new Map<number, { nome: string; nomeCompleto: string; tipo: string; grupos: Map<string, number> }>();
  for (const p of await db.promotor.findMany())
    carga.set(p.id, { nome: p.apelido, nomeCompleto: p.nome, tipo: p.tipo, grupos: new Map() });
  for (const d of designacoesFinais) {
    if (!d.promotorId || !d.promotor) continue;
    // A carga pertence ao cargo original quando a audiência é servida por cobertura.
    const cob = cobrindoDe(d.promotorId, d.data, d.posicao.codigo);
    const alvoId = cob?.afastadoId ?? d.promotorId;
    const c = carga.get(alvoId);
    if (!c) continue;
    const g = c.grupos.get(d.posicao.grupo) ?? 0;
    c.grupos.set(d.posicao.grupo, g + (pesoDe.get(d.posicao.grupo) ?? 1));
  }
  const ORDEM_TIPO: Record<string, number> = { TITULAR: 0, AUXILIAR: 1, REGIONAL: 2, SUBSTITUTO: 3 };
  for (const c of [...carga.values()].sort((a, b) => {
    const ta = ORDEM_TIPO[a.tipo] ?? 9;
    const tb = ORDEM_TIPO[b.tipo] ?? 9;
    if (ta !== tb) return ta - tb;
    return (
      [...b.grupos.values()].reduce((s, v) => s + v, 0) - [...a.grupos.values()].reduce((s, v) => s + v, 0)
    );
  })) {
    const p = promotoresCarga.find((x) => x.apelido === c.nome);
    const anterior = p ? Object.values(saldoAnterior.get(p.id) ?? {}).reduce((s, v) => s + v, 0) : 0;
    const total = [...c.grupos.values()].reduce((s, v) => s + v, 0);
    resumo.addRow({
      nome: c.nome,
      tipo: c.tipo,
      nomeCompleto: c.nomeCompleto,
      ...Object.fromEntries(gruposDb.map((g) => [`g${g.grupo}`, c.grupos.get(g.grupo) ?? 0])),
       anterior,
       total,
       acumulado: anterior + total,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="escala-${escala.mes}-${escala.ano}.xlsx"`,
    },
  });
}

export const GET = withApiError("escalas.id.export.GET", getHandler);

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO_TROCAS, TODOS, exigir } from "@/lib/auth";
import { dataISO, inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

export const dynamic = "force-dynamic";

const include = {
  posicao: { select: { id: true, codigo: true, nome: true } },
  promotorOrigem: { select: { id: true, apelido: true, nome: true } },
  promotorDestino: { select: { id: true, apelido: true, nome: true } },
};

async function promotoresDoOficial(email: string) {
  const contas = await db.usuarioPapel.findMany({ where: { papel: "PROMOTOR", oficialEmail: email.toLowerCase() }, select: { email: true } });
  const emails = new Set(contas.map((u) => u.email.toLowerCase()));
  const locais = new Set(contas.map((u) => u.email.toLowerCase().split("@")[0]));
  const promotores = await db.promotor.findMany({ select: { id: true, email: true, apelido: true } });
  return new Set(promotores.filter((p) => emails.has((p.email ?? "").toLowerCase()) || locais.has(p.apelido.toLowerCase())).map((p) => p.id));
}

async function getHandler(req: Request) {
  const g = await exigir(req, TODOS);
  if ("erro" in g) return g.erro;
  const url = new URL(req.url);
  const ano = Number(url.searchParams.get("ano"));
  const mes = Number(url.searchParams.get("mes"));
  const filtro = ano >= 2000 && mes >= 1 && mes <= 12 ? { data: { gte: `${ano}-${String(mes).padStart(2, "0")}-01`, lt: `${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01` } } : undefined;
  const trocas = await db.troca.findMany({ where: filtro, orderBy: [{ data: "desc" }, { id: "desc" }], include });
  const promotores = await db.promotor.findMany({ where: { ativo: true }, orderBy: { apelido: "asc" }, select: { id: true, apelido: true, nome: true, email: true } });
  const escalas = await db.escala.findMany({
    where: ano >= 2000 && mes >= 1 && mes <= 12 ? { ano, mes } : undefined,
    include: { designacoes: { select: { data: true, posicaoId: true, promotorId: true, posicao: { select: { codigo: true, nome: true } } } } },
  });
  const opcoes = [...new Map(escalas.flatMap((e) => e.designacoes.map((d) => [`${d.data}|${d.posicaoId}`, { data: d.data, posicaoId: d.posicaoId, codigo: d.posicao.codigo, nome: d.posicao.nome, promotorId: d.promotorId }]))).values()];
  return NextResponse.json({ trocas, promotores, opcoes });
}

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO_TROCAS);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const data = dataISO(body?.data);
  const posicaoId = inteiroPositivo(body?.posicaoId);
  const origem = body?.promotorOrigemId === "VAGA" || body?.promotorOrigemId === null || body?.promotorOrigemId === "" || body?.promotorOrigemId === undefined
    ? null
    : inteiroPositivo(body.promotorOrigemId);
  const destino = inteiroPositivo(body?.promotorDestinoId);
  const observacao = texto(body?.observacao, 500);
  if (!body || !data || !posicaoId || (body.promotorOrigemId !== "VAGA" && body.promotorOrigemId !== null && body.promotorOrigemId !== "" && body.promotorOrigemId !== undefined && origem === null) || !destino || origem === destino || observacao === null) {
    return NextResponse.json({ erro: "Informe dia, posição e promotor que assumirá." }, { status: 400 });
  }
  if (g.papel === "OFICIAL" && (origem === null || !(await promotoresDoOficial(g.email)).has(origem))) {
    return NextResponse.json({ erro: "O Oficial só pode lançar trocas relativas ao seu promotor." }, { status: 403 });
  }
  const escala = await db.escala.findFirst({ where: { ano: Number(data.slice(0, 4)), mes: Number(data.slice(5, 7)) } });
  if (!escala) return NextResponse.json({ erro: "Gere a escala do mês antes de lançar uma troca." }, { status: 409 });
  const designada = await db.designacao.findUnique({ where: { escalaId_data_posicaoId: { escalaId: escala.id, data, posicaoId } } });
  if (!designada) return NextResponse.json({ erro: "Posição não encontrada na escala desse dia." }, { status: 409 });
  if (designada.promotorId !== origem) return NextResponse.json({ erro: origem === null ? "Essa posição já possui um promotor designado." : "O promotor informado não é o designado original dessa posição." }, { status: 409 });
  if (!(await db.promotor.findUnique({ where: { id: destino }, select: { id: true, ativo: true } }))?.ativo) {
    return NextResponse.json({ erro: "Promotor que assumirá não encontrado ou inativo." }, { status: 400 });
  }
  const existente = await db.troca.findUnique({ where: { data_posicaoId: { data, posicaoId } } });
  if (existente) return NextResponse.json({ erro: "Já existe um ajuste para essa posição nesse dia." }, { status: 409 });
  const criada = await db.troca.create({ data: { data, posicaoId, promotorOrigemId: origem, promotorDestinoId: destino, observacao: observacao || null } });
  return NextResponse.json(await db.troca.findUnique({ where: { id: criada.id }, include }), { status: 201 });
}

export const GET = withApiError("trocas.GET", getHandler);
export const POST = withApiError("trocas.POST", postHandler);

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estaDisponivel, atuaEm, atuaNaVara } from "@/lib/gerador";
import { segundaDe } from "@/lib/datas";
import { EDICAO, exigir } from "@/lib/auth";
import { inteiroPositivo, lerObjeto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

async function patchHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const { id } = await params;
  const designacaoId = inteiroPositivo(id);
  if (!designacaoId) return NextResponse.json({ erro: "Designacao invalida" }, { status: 400 });
  const body = await lerObjeto(req);
  if (!body) return NextResponse.json({ erro: "Corpo da requisicao invalido" }, { status: 400 });
  const designacao = await db.designacao.findUnique({
    where: { id: designacaoId },
    include: { escala: true, posicao: true },
  });
  if (!designacao) return NextResponse.json({ erro: "Designação não encontrada" }, { status: 404 });
  if (designacao.escala.status === "PUBLICADA") {
    return NextResponse.json({ erro: "Escala publicada: reabra-a para editar" }, { status: 409 });
  }
  if (body.travada !== undefined) {
    if (typeof body.travada !== "boolean") {
      return NextResponse.json({ erro: "travada deve ser booleano" }, { status: 400 });
    }
    const atualizada = await db.designacao.update({ where: { id: designacao.id }, data: { travada: body.travada } });
    return NextResponse.json(atualizada);
  }
  if (designacao.travada && !body.forcar) {
    return NextResponse.json({ erro: "Célula travada. Destrave antes de editar." }, { status: 409 });
  }

  const novoPromotorId =
    body.promotorId === null || body.promotorId === "" || body.promotorId === undefined
      ? null
      : Number(body.promotorId);
  if (novoPromotorId !== null && !Number.isInteger(novoPromotorId)) {
    return NextResponse.json({ erro: "promotorId inválido" }, { status: 400 });
  }

  if (novoPromotorId !== null) {
    const promotor = await db.promotor.findUnique({
      where: { id: novoPromotorId },
      include: {
        bloqueios: true,
        varas: true,
        regras: { include: { regra: true } },
        portariasAfastado: true,
        portariasCobridor: true,
      },
    });
    if (!promotor) return NextResponse.json({ erro: "Promotor não encontrado" }, { status: 404 });

    const varasAfastados = await db.promotorVara.findMany({
      where: { promotorId: { in: promotor.portariasCobridor.map((pt) => pt.promotorAfastadoId) } },
    });
    const varasPorId = new Map<number, number[]>();
    for (const v of varasAfastados) {
      const lista = varasPorId.get(v.promotorId) ?? [];
      lista.push(v.vara);
      varasPorId.set(v.promotorId, lista);
    }
    const regrasAfastados = await db.promotorRegra.findMany({
      where: { promotorId: { in: promotor.portariasCobridor.map((pt) => pt.promotorAfastadoId) } },
      include: { regra: true },
    });
    const regrasPorId = new Map<number, { tipo: string; diasCsv: string; gruposCsv: string }[]>();
    for (const pr of regrasAfastados) {
      const lista = regrasPorId.get(pr.promotorId) ?? [];
      lista.push({ tipo: pr.regra.tipo, diasCsv: pr.regra.diasCsv, gruposCsv: pr.regra.gruposCsv });
      regrasPorId.set(pr.promotorId, lista);
    }
    const afastadosRows = await db.promotor.findMany({
      where: { id: { in: promotor.portariasCobridor.map((pt) => pt.promotorAfastadoId) } },
      select: { id: true, atuacao: true, tipo: true },
    });
    const atuacaoPorId = new Map(afastadosRows.map((p) => [p.id, p.atuacao]));
    const auxiliarPorId = new Map(afastadosRows.map((p) => [p.id, p.tipo === "AUXILIAR"]));

    const promotorInput = {
      ...promotor,
      varas: promotor.varas.map((v) => v.vara),
      regras: promotor.regras.map((pr) => ({
        tipo: pr.regra.tipo,
        diasCsv: pr.regra.diasCsv,
        gruposCsv: pr.regra.gruposCsv,
      })),
      portarias: promotor.portariasAfastado.map((pt) => ({ inicio: pt.inicio, fim: pt.fim })),
      coberturas: promotor.portariasCobridor.map((pt) => ({
        inicio: pt.inicio,
        fim: pt.fim,
        varas: varasPorId.get(pt.promotorAfastadoId) ?? [],
        regras: regrasPorId.get(pt.promotorAfastadoId) ?? [],
        afastadoId: pt.promotorAfastadoId,
        atuaAfastado: atuacaoPorId.get(pt.promotorAfastadoId) ?? "TODAS",
        modalidade: pt.modalidade,
        afastadoAuxiliar: auxiliarPorId.get(pt.promotorAfastadoId) ?? false,
      })),
    };
    if (
      !estaDisponivel(
        promotorInput,
        designacao.data,
        designacao.posicao.codigo,
        designacao.posicaoId,
        designacao.posicao.grupo
      )
    ) {
      let motivo = "indisponível";
      if (!atuaEm(promotor, designacao.posicao.codigo)) {
        const rotulos: Record<string, string> = {
          CUSTODIA: "somente Custódia",
          PLANTAO: "somente Plantão",
          CUSTODIA_PLANTAO: "Custódia e Plantão",
        };
        motivo = `atuação restrita (${rotulos[promotor.atuacao] ?? promotor.atuacao})`;
      } else if (!atuaNaVara(promotorInput, designacao.posicao.codigo)) {
        motivo = "sem vínculo com essa Vara";
      } else if (promotor.regras.some((pr) => pr.regra.gruposCsv === "" || pr.regra.gruposCsv.split(",").includes(designacao.posicao.grupo))) {
        motivo = "regra de dias da semana";
      } else if (!promotor.ativo) {
        motivo = "inativo";
      } else {
        const portariaAfastando = promotor.portariasAfastado.find(
          (pt) => pt.inicio <= designacao.data && designacao.data <= pt.fim
        );
        motivo = portariaAfastando
          ? `afastado (portaria ${portariaAfastando.numero ?? "sem nº"})`
          : "bloqueado";
      }
      return NextResponse.json({ erro: `${promotor.apelido} está ${motivo} nesta data/posição` }, { status: 409 });
    }

    const conflitoDia = await db.designacao.findFirst({
      where: {
        escalaId: designacao.escalaId,
        data: designacao.data,
        promotorId: novoPromotorId,
        id: { not: designacao.id },
      },
    });
    // Cargos genéricos (placeholders) podem acumular posições no mesmo dia.
    if (conflitoDia && designacao.posicao.codigo !== "C" && !promotor.generico) {
      return NextResponse.json(
        { erro: `${promotor.apelido} já possui designação neste dia` },
        { status: 409 }
      );
    }

    // Limite da função de secretário: 1 audiência por semana.
    if (designacao.posicao.grupo === "AUDIENCIAS") {
      const cargos = await db.cargoAdministrativo.findMany();
      const secretarioId = cargos.find((c) => c.cargo === "SECRETARIO")?.promotorId ?? null;
      const subSecretarioId = cargos.find((c) => c.cargo === "SUBSECRETARIO")?.promotorId ?? null;
      const cargo =
        novoPromotorId === secretarioId
          ? "SECRETARIO"
          : novoPromotorId === subSecretarioId
            ? "SUBSECRETARIO"
            : null;
      let limitado = cargo === "SECRETARIO";
      if (cargo === "SUBSECRETARIO" && secretarioId) {
        const periodos = await db.portaria.findMany({
          where: { promotorAfastadoId: secretarioId },
          select: { inicio: true, fim: true },
        });
        limitado = periodos.some((c) => c.inicio <= designacao.data && designacao.data <= c.fim);
      }
      if (limitado) {
        const semana = segundaDe(designacao.data);
        const [d1, d2] = [semana, new Date(new Date(semana + "T00:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10)];
        const outras = await db.designacao.count({
          where: {
            escalaId: designacao.escalaId,
            promotorId: novoPromotorId,
            id: { not: designacao.id },
            data: { gte: d1, lte: d2 },
            posicao: { grupo: "AUDIENCIAS" },
          },
        });
        if (outras >= 1) {
          const rotulo = cargo === "SECRETARIO" ? "Secretário" : "Sub-secretário (em função)";
          return NextResponse.json(
            { erro: `${promotor.apelido} é ${rotulo}: só faz 1 audiência por semana` },
            { status: 409 }
          );
        }
      }
    }
  }

  // Modo HTTP do Neon: write com include vira transação (não suportada) — write simples + leitura.
  const atualizada = await db.designacao.update({
    where: { id: designacao.id },
    data: { promotorId: novoPromotorId, origem: "MANUAL" },
  });
  const promotor = novoPromotorId
    ? await db.promotor.findUnique({ where: { id: novoPromotorId }, select: { id: true, apelido: true } })
    : null;
  return NextResponse.json({ ...atualizada, promotor });
}

export const PATCH = withApiError("designacoes.id.PATCH", patchHandler);

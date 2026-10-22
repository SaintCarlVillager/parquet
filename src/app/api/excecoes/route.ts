import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDICAO, exigir } from "@/lib/auth";
import { dataISO, inteiroPositivo, lerObjeto, texto } from "@/lib/validacao";
import { withApiError } from "@/lib/errosApi";

async function postHandler(req: Request) {
  const g = await exigir(req, EDICAO);
  if ("erro" in g) return g.erro;
  const body = await lerObjeto(req);
  const data = dataISO(body?.data);
  const posicaoId = inteiroPositivo(body?.posicaoId);
  const motivo = texto(body?.motivo, 500);
  if (!body || !data || !posicaoId || motivo === null || typeof body.ativa !== "boolean") {
    return NextResponse.json({ erro: "Data e posição são obrigatórias" }, { status: 400 });
  }
  const [ano, mes] = data.split("-").map(Number);
  const escala = await db.escala.findUnique({ where: { ano_mes: { ano, mes } } });
  if (escala?.status === "PUBLICADA") {
    return NextResponse.json({ erro: "Escala publicada: reabra-a para editar" }, { status: 409 });
  }
  const excecao = await db.gradeExcecao.upsert({
    where: { data_posicaoId: { data, posicaoId } },
    update: { ativa: body.ativa, motivo: motivo || null },
    create: {
      data,
      posicaoId,
      ativa: body.ativa,
      motivo: motivo || null,
    },
  });
  if (!body.ativa && escala) {
    await db.designacao.deleteMany({ where: { escalaId: escala.id, data, posicaoId } });
  }
  return NextResponse.json(excecao, { status: 201 });
}

export const POST = withApiError("excecoes.POST", postHandler);

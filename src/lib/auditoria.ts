import { usuarioDaRequisicao } from "./auth";
import { db } from "./db";

export type ResultadoAuditoria = "SUCESSO" | "FALHA";

export type EventoAuditoria = {
  requestId: string;
  contexto: string;
  acao: string;
  recurso: string;
  resultado: ResultadoAuditoria;
};

export async function registrarAuditoria(evento: EventoAuditoria, req?: Request): Promise<void> {
  try {
    const sessao = req ? usuarioDaRequisicao(req) : null;
    await db.auditoria.create({
      data: {
        ...evento,
        usuarioEmail: sessao?.email ?? null,
        papel: sessao?.papel ?? null,
      },
    });
  } catch {
    console.error("AUDIT_ERROR", { requestId: evento.requestId, contexto: evento.contexto });
  }
}

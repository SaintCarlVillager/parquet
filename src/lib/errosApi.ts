import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function erroInterno(contexto: string, erro: unknown, requestId = randomUUID()) {
  console.error("API_ERROR", { requestId, errorId: requestId, contexto, erro: erro instanceof Error ? erro.stack : erro });
  return NextResponse.json({ erro: "Erro interno do servidor", errorId: requestId }, { status: 500, headers: { "x-request-id": requestId } });
}

type Handler = (...args: never[]) => Response | Promise<Response>;

export function withApiError<T extends Handler>(contexto: string, handler: T): (...args: Parameters<T>) => Promise<Response> {
  const executar = handler as unknown as (...args: unknown[]) => Response | Promise<Response>;
  return async (...args) => {
    const req = (args as unknown[]).find((arg): arg is Request => arg instanceof Request);
    const requestId = randomUUID();
    const mutavel = ["POST", "PUT", "PATCH", "DELETE"].includes(req?.method ?? "");
    const { registrarAuditoria } = await import("./auditoria");
    const recurso = req ? new URL(req.url).pathname : "desconhecido";
    try {
      const resposta = await executar(...args);
      if (mutavel) {
        await registrarAuditoria({ requestId, contexto, acao: req!.method, recurso, resultado: resposta.status >= 400 ? "FALHA" : "SUCESSO" }, req);
      }
      return resposta;
    } catch (erro) {
      const resposta = erroInterno(contexto, erro, requestId);
      if (mutavel) {
        await registrarAuditoria({ requestId, contexto, acao: req!.method, recurso, resultado: "FALHA" }, req);
      }
      return resposta;
    }
  };
}

export function codigoPrisma(erro: unknown): string | null {
  return erro && typeof erro === "object" && "code" in erro && typeof erro.code === "string" ? erro.code : null;
}

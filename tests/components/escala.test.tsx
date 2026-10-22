import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao } = vi.hoisted(() => ({ sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste" })) }));

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditar: () => true }));

import EscalaPage from "../../src/app/(app)/escala/page";

const agora = new Date();
const mesAtual = agora.getMonth() + 1;
const anoAtual = agora.getFullYear();

function escalaAtual(status = "RASCUNHO") {
  return { id: 1, ano: anoAtual, mes: mesAtual, status };
}

function payloadAtual(status = "RASCUNHO") {
  return {
    escala: escalaAtual(status),
    designacoes: [],
    promotores: [],
    posicoes: [],
    grupos: [],
    feriados: [],
    gradeItens: [],
    excecoes: [],
    saldoAnterior: {},
  };
}

describe("carregamento de Escala", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra carregamento e nao estado vazio enquanto a API esta pendente", async () => {
    let resolver: (valor: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
    render(<EscalaPage />);
    expect(screen.getByText(/Carregando escala de/)).toBeInTheDocument();
    expect(screen.queryByText(/Ainda não existe escala para/)).not.toBeInTheDocument();
    resolver(new Response(JSON.stringify([]), { status: 200 }));
    await waitFor(() => expect(screen.getByText(/Ainda não existe escala para/)).toBeInTheDocument());
  });

  it("mostra erro quando nao consegue carregar as escalas", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))));
    render(<EscalaPage />);
    await waitFor(() => expect(screen.getByText("Erro ao carregar escalas (HTTP 503)."))
      .toBeInTheDocument());
    expect(screen.queryByText(/Ainda não existe escala para/)).not.toBeInTheDocument();
  });

  it("desabilita Gerar escala e informa que esta criando durante o POST", async () => {
    let concluirPost: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { concluirPost = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalaPage />);
    const botao = await screen.findByRole("button", { name: "Gerar escala" });
    fireEvent.click(botao);

    expect(await screen.findByRole("button", { name: "Criando…" })).toBeDisabled();
    concluirPost(new Response(null, { status: 200 }));
    await waitFor(() => expect(screen.getByText(/Esqueleto da escala criado/)).toBeInTheDocument());
  });

  it("nao mostra audiencia em posicao desligada mesmo com designacao remanescente", async () => {
    const inicio = new Date(anoAtual, mesAtual - 1, 1);
    while (inicio.getDay() !== 1) inicio.setDate(inicio.getDate() + 1);
    const iso = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;
    const payload = {
      ...payloadAtual(),
      posicoes: [{ id: 3, codigo: "1'", nome: "1a Auxiliar", grupo: "AUDIENCIAS", ordem: 2 }],
      gradeItens: [{ diaSemana: 1, posicaoId: 3 }],
      excecoes: [{ id: 1, data: iso, posicaoId: 3, ativa: false }],
      promotores: [{
        id: 15, apelido: "PJS", nome: "PJS", email: null, tipo: "SUBSTITUTO", atuacao: "TODAS",
        varas: [], ativo: true, generico: true, portarias: [], coberturas: [], bloqueios: [], regras: [],
      }],
      designacoes: [{ id: 9, data: iso, posicaoId: 3, promotorId: 15, promotor: { id: 15, apelido: "PJS" }, origem: "MANUAL", travada: false }],
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escalaAtual()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 })));
    render(<EscalaPage />);
    await screen.findByRole("button", { name: "Gerar designações" });
    expect(document.querySelectorAll("select.manual")).toHaveLength(0);
  });

  it("desabilita Gerar designacoes e informa que esta gerando durante o POST", async () => {
    let concluirPost: (response: Response) => void = () => undefined;
    const payload = payloadAtual();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escalaAtual()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { concluirPost = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify([escalaAtual()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalaPage />);
    const botao = await screen.findByRole("button", { name: "Gerar designações" });
    fireEvent.click(botao);

    expect(await screen.findByRole("button", { name: "Gerando…" })).toBeDisabled();
    concluirPost(new Response(null, { status: 200 }));
    await waitFor(() => expect(screen.getByText("Designações geradas para as vagas sem ajuste manual.")).toBeInTheDocument());
  });

  it("desabilita Exportar Excel e informa que esta exportando durante o download", async () => {
    let concluirExportacao: (response: Response) => void = () => undefined;
    const payload = payloadAtual();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escalaAtual()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { concluirExportacao = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:escala"), revokeObjectURL: vi.fn() });
    const clickDownload = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<EscalaPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar Excel" }));

    expect(await screen.findByRole("button", { name: "Exportando…" })).toBeDisabled();
    concluirExportacao({ ok: true, blob: async () => new Blob(["xlsx"]) } as Response);
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar Excel" })).toBeInTheDocument());
    expect(clickDownload).toHaveBeenCalledOnce();
  });

  it("mostra erro e libera Exportar Excel se a requisicao falhar", async () => {
    const payload = payloadAtual();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escalaAtual()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ erro: "Falha ao gerar planilha" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalaPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar Excel" }));

    expect(await screen.findByText("Falha ao gerar planilha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toBeEnabled();
  });
});

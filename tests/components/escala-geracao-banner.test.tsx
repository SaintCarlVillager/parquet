import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao } = vi.hoisted(() => ({ sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste" })) }));

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditar: () => true }));

import EscalaPage from "../../src/app/(app)/escala/page";

describe("banner de vagas sem candidato", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fica oculto durante a geracao e a atualizacao dos dados finais", async () => {
    const agora = new Date();
    const escala = { id: 1, ano: agora.getFullYear(), mes: agora.getMonth() + 1, status: "RASCUNHO" };
    const payloadComVaga = {
      escala,
      designacoes: [{ id: 1, data: `${escala.ano}-${String(escala.mes).padStart(2, "0")}-01`, posicaoId: 1, promotorId: null, origem: "AUTO", travada: false }],
      promotores: [],
      posicoes: [{ id: 1, codigo: "N", nome: "Titular", grupo: "TITULAR", ordem: 1 }],
      grupos: [], feriados: [], gradeItens: [], excecoes: [], saldoAnterior: {},
    };
    const payloadFinal = { ...payloadComVaga, designacoes: [{ ...payloadComVaga.designacoes[0], promotorId: 2 }] };
    let concluirPost: (response: Response) => void = () => undefined;
    let concluirPayloadFinal: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escala]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payloadComVaga), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { concluirPost = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify([escala]), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { concluirPayloadFinal = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EscalaPage />);
    expect(await screen.findByText(/Atenção: 1 posição\(ões\) sem candidato disponível/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gerar designações" }));

    await waitFor(() => expect(screen.queryByText(/Atenção: 1 posição\(ões\) sem candidato disponível/)).not.toBeInTheDocument());
    concluirPost(new Response(null, { status: 200 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(screen.queryByText(/Atenção: 1 posição\(ões\) sem candidato disponível/)).not.toBeInTheDocument();

    concluirPayloadFinal(new Response(JSON.stringify(payloadFinal), { status: 200 }));
    await waitFor(() => expect(screen.getByText("Designações geradas para as vagas sem ajuste manual.")).toBeInTheDocument());
    expect(screen.queryByText(/posição\(ões\) sem candidato disponível/)).not.toBeInTheDocument();
  });

  it("nao avisa vaga manual deixada de proposito", async () => {
    const agora = new Date();
    const escala = { id: 1, ano: agora.getFullYear(), mes: agora.getMonth() + 1, status: "RASCUNHO" };
    const payload = {
      escala,
      designacoes: [{ id: 1, data: `${escala.ano}-${String(escala.mes).padStart(2, "0")}-08`, posicaoId: 1, promotorId: null, origem: "MANUAL", travada: false }],
      promotores: [],
      posicoes: [{ id: 1, codigo: "6'", nome: "6a Auxiliar", grupo: "AUDIENCIAS", ordem: 12 }],
      grupos: [], feriados: [], gradeItens: [], excecoes: [], saldoAnterior: {},
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([escala]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 })));
    render(<EscalaPage />);
    await screen.findByRole("button", { name: "Gerar designações" });
    expect(screen.queryByText(/sem candidato disponível/)).not.toBeInTheDocument();
  });
});

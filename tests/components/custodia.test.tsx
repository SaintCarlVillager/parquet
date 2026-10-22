import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao } = vi.hoisted(() => ({ sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste" })) }));

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditar: () => true }));

import CustodiaPage from "../../src/app/(app)/custodia/page";

describe("carregamento de Custodia", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra carregamento e nao estado vazio enquanto a API esta pendente", async () => {
    let resolver: (valor: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
    render(<CustodiaPage />);
    expect(screen.getByText("Carregando dados de custódia…")).toBeInTheDocument();
    expect(screen.queryByText(/Não existe escala para/)).not.toBeInTheDocument();
    resolver(new Response(JSON.stringify([]), { status: 200 }));
    await waitFor(() => expect(screen.getByText(/Não existe escala para/)).toBeInTheDocument());
  });

  it("mostra erro quando nao consegue carregar as escalas", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))));
    render(<CustodiaPage />);
    await waitFor(() => expect(screen.getByText("Erro ao carregar escalas (HTTP 503)."))
      .toBeInTheDocument());
    expect(screen.queryByText(/Não existe escala para/)).not.toBeInTheDocument();
  });
});

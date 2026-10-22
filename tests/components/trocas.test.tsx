import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao } = vi.hoisted(() => ({ sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste" })) }));

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditarTrocas: () => true }));

import TrocasPage from "../../src/app/(app)/trocas/page";

describe("carregamento de Trocas", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("separa carregamento de posições do estado vazio", async () => {
    let resolver: (valor: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
    render(<TrocasPage />);
    expect(screen.getByText("Carregando posições disponíveis…")).toBeInTheDocument();
    expect(screen.queryByText("Não há posições disponíveis neste mês. Gere a escala antes de lançar ajustes.")).not.toBeInTheDocument();
    resolver(new Response(JSON.stringify({ trocas: [], promotores: [], opcoes: [] }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("Não há posições disponíveis neste mês. Gere a escala antes de lançar ajustes.")).toBeInTheDocument());
  });
});

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao } = vi.hoisted(() => ({ sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste" })) }));

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditar: () => true }));
vi.mock("@/app/components/ImportarExcel", () => ({ default: () => <button>Importar</button> }));

import PortariasPage from "../../src/app/(app)/portarias/page";

describe("carregamento de Portarias", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("mostra carregamento e nao estado vazio enquanto a API esta pendente", async () => {
    let resolver: (valor: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
    render(<PortariasPage />);
    expect(screen.getByText("Carregando portarias…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma portaria lançada.")).not.toBeInTheDocument();
    resolver(new Response(JSON.stringify({ portarias: [], promotores: [] }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("Nenhuma portaria lançada.")).toBeInTheDocument());
  });
});

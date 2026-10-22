import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessao, rotaAtual } = vi.hoisted(() => {
  const rota = { valor: "/escala" };
  return {
    sessao: vi.fn(() => ({ papel: "CHEFE", email: "chefe@teste", nome: "Chefe" })),
    rotaAtual: rota,
  };
});

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: sessao, podeEditar: () => true }));
vi.mock("next/navigation", () => ({ usePathname: () => rotaAtual.valor }));

import { TourProvider, useTour } from "../../src/app/components/TourProvider";

function Alvos() {
  return (
    <div>
      <div data-tour="/escala-titulo">t</div>
      <div data-tour="escala-controles">c</div>
      <div data-tour="escala-gerar">g</div>
      <div data-tour="escala-gerar-desig">gd</div>
      <div data-tour="escala-tabela">tb</div>
      <div data-tour="escala-carga">cg</div>
    </div>
  );
}

function AlvosSemDesig() {
  return (
    <div>
      <div data-tour="/escala-titulo">t</div>
      <div data-tour="escala-controles">c</div>
      <div data-tour="escala-gerar">g</div>
      <div data-tour="escala-tabela">tb</div>
      <div data-tour="escala-carga">cg</div>
    </div>
  );
}

function Consumidor() {
  const { abrirTour, primeiraVisita } = useTour();
  return (
    <button type="button" data-testid="abrir" onClick={abrirTour}>
      ?{primeiraVisita ? " novo" : ""}
    </button>
  );
}

function montar(children: React.ReactNode = <Alvos />) {
  return render(
    <TourProvider>
      <Consumidor />
      {children}
    </TourProvider>
  );
}

describe("TourProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("inicia automaticamente na primeira visita e mostra badge", async () => {
    const { getByTestId } = montar();
    expect(getByTestId("abrir").textContent).toBe("? novo");
    await waitFor(() => expect(screen.getByText("Escala mensal")).toBeInTheDocument());
    expect(screen.getByText(/1\/6/)).toBeInTheDocument();
  });

  it("persiste a visita e nao reabre automaticamente", async () => {
    window.localStorage.setItem("tour:chefe@teste", "1");
    montar();
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText("Escala mensal")).not.toBeInTheDocument();
    expect(screen.getByTestId("abrir").textContent).not.toContain("novo");
  });

  it("avanca, volta e conclui no ultimo passo", async () => {
    const { getByTestId } = montar();
    await waitFor(() => expect(screen.getByText("Escala mensal")).toBeInTheDocument());
    expect(getByTestId("abrir").textContent).toBe("? novo");
    fireEvent.click(screen.getByText("Avançar"));
    await waitFor(() => expect(screen.getByText("Mês e ano")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Voltar"));
    await waitFor(() => expect(screen.getByText("Escala mensal")).toBeInTheDocument());
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Avançar"));
    }
    await waitFor(() => expect(screen.getByText("Concluir")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Concluir"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getByTestId("abrir").textContent).toBe("?");
    expect(window.localStorage.getItem("tour:chefe@teste")).toBe("1");
  });

  it("pula graciosamente o passo cujo alvo nao existe", async () => {
    montar(<AlvosSemDesig />);
    await waitFor(() => expect(screen.getByText("Escala mensal")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Avançar"));
    await waitFor(() => expect(screen.getByText("Mês e ano")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Avançar"));
    await waitFor(() => expect(screen.getByText("Gerar escala")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Avançar"));
    await waitFor(() => expect(screen.getByText("Tabela da escala")).toBeInTheDocument());
    expect(screen.queryByText("Gerar designações")).not.toBeInTheDocument();
  });

  it("botao de abrir permite rever mesmo ja visitado", async () => {
    window.localStorage.setItem("tour:chefe@teste", "1");
    const { getByTestId } = montar();
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(getByTestId("abrir"));
    await waitFor(() => expect(screen.getByText("Escala mensal")).toBeInTheDocument());
  });
});

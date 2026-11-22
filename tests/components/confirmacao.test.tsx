import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmacaoProvider, useConfirmacao } from "../../src/app/components/ConfirmacaoProvider";

function Gatilho() {
  const { confirmar, avisar } = useConfirmacao();
  const [resultado, setResultado] = useState("");
  return (
    <>
      <button type="button" onClick={async () => setResultado(String(await confirmar({ titulo: "Excluir item?", mensagem: "Não pode ser desfeito.", acao: "Excluir" })))}>
        pedir
      </button>
      <button type="button" onClick={async () => { await avisar("Feito."); setResultado("avisado"); }}>
        avisar
      </button>
      <output data-testid="resultado">{resultado}</output>
    </>
  );
}

function montar() {
  return render(
    <ConfirmacaoProvider>
      <Gatilho />
    </ConfirmacaoProvider>
  );
}

const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
const originais = { showModal: proto.showModal, close: proto.close };

describe("ConfirmacaoProvider com <dialog> nativo", () => {
  beforeEach(() => {
    proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    proto.close = function (this: HTMLDialogElement, valor?: string) {
      if (valor !== undefined) this.returnValue = valor;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });
  afterEach(() => {
    proto.showModal = originais.showModal;
    proto.close = originais.close;
    vi.restoreAllMocks();
  });

  it("abre um dialogo modal nomeado pelo titulo, com foco inicial em Cancelar", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    montar();
    fireEvent.click(screen.getByText("pedir"));
    const dialogo = await screen.findByRole("dialog", { name: "Excluir item?" });
    expect(showModal).toHaveBeenCalled();
    expect(dialogo).not.toHaveAttribute("role");
    expect(dialogo).not.toHaveAttribute("aria-modal");
    expect(screen.getByText("Cancelar")).toHaveFocus();
  });

  it("resolve true ao confirmar e false ao dispensar sem escolher", async () => {
    montar();
    const dialogo = document.querySelector("dialog")!;

    fireEvent.click(screen.getByText("pedir"));
    await screen.findByRole("dialog");
    dialogo.close("confirmar");
    await waitFor(() => expect(screen.getByTestId("resultado").textContent).toBe("true"));
    expect(dialogo.returnValue).toBe("");

    fireEvent.click(screen.getByText("pedir"));
    await screen.findByRole("dialog");
    dialogo.close();
    await waitFor(() => expect(screen.getByTestId("resultado").textContent).toBe("false"));
  });

  it("aviso foca o OK e resolve ao fechar", async () => {
    montar();
    fireEvent.click(screen.getByText("avisar"));
    await screen.findByText("Feito.");
    expect(screen.getByText("OK")).toHaveFocus();
    document.querySelector("dialog")!.close();
    await waitFor(() => expect(screen.getByTestId("resultado").textContent).toBe("avisado"));
  });
});

describe("ConfirmacaoProvider sem suporte a <dialog> modal", () => {
  it("cai no window.confirm", async () => {
    const original = proto.showModal;
    // @ts-expect-error simula navegador sem <dialog> modal
    proto.showModal = undefined;
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      montar();
      fireEvent.click(screen.getByText("pedir"));
      await waitFor(() => expect(screen.getByTestId("resultado").textContent).toBe("true"));
      expect(confirmar).toHaveBeenCalledWith("Excluir item?\n\nNão pode ser desfeito.");
    } finally {
      proto.showModal = original;
      confirmar.mockRestore();
    }
  });
});

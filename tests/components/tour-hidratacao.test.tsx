import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/SessaoProvider", () => ({ useSessao: () => ({ papel: "CHEFE", email: "novo@teste", nome: "N" }), podeEditar: () => true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { TourProvider, useTour } from "../../src/app/components/TourProvider";

function Consumidor() {
  const { primeiraVisita } = useTour();
  return <span>{primeiraVisita ? "novo" : "visto"}</span>;
}

describe("TourProvider na hidratacao", () => {
  it("renderiza o primeiro quadro igual ao servidor, sem ler localStorage", () => {
    window.localStorage.clear();
    const html = renderToString(<TourProvider><Consumidor /></TourProvider>);
    expect(html).toContain("visto");
  });
});

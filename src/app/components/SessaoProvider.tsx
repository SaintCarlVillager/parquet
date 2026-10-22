"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessaoUi } from "./SideNav";

const Ctx = createContext<SessaoUi | null>(null);

export function SessaoProvider({ sessao, children }: { sessao: SessaoUi; children: ReactNode }) {
  return <Ctx.Provider value={sessao}>{children}</Ctx.Provider>;
}

export function useSessao(): SessaoUi {
  return useContext(Ctx) ?? { nome: "", papel: "PROMOTOR", email: "" };
}

export function podeEditar(papel: SessaoUi["papel"]): boolean {
  return papel === "CHEFE";
}

export function podeEditarTrocas(papel: SessaoUi["papel"]): boolean {
  return papel === "CHEFE" || papel === "OFICIAL";
}

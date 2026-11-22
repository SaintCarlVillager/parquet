"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface PedidoConfirmacao {
  titulo: string;
  mensagem: string;
  acao?: string;
}

interface Controle {
  confirmar: (pedido: PedidoConfirmacao) => Promise<boolean>;
  avisar: (mensagem: string, titulo?: string) => Promise<void>;
}

const Ctx = createContext<Controle>({
  confirmar: async ({ titulo, mensagem }) => window.confirm(`${titulo}\n\n${mensagem}`),
  avisar: async (mensagem) => window.alert(mensagem),
});

export function useConfirmacao(): Controle {
  return useContext(Ctx);
}

interface Pendente {
  tipo: "confirmar" | "aviso";
  titulo: string;
  mensagem: string;
  acao: string;
  resolver: (ok: boolean) => void;
}

const CONFIRMOU = "confirmar";

export function ConfirmacaoProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);

  const pedir = useCallback(
    (p: Omit<Pendente, "resolver">) =>
      new Promise<boolean>((resolver) => {
        const dialogo = ref.current;
        if (!dialogo || typeof dialogo.showModal !== "function") {
          if (p.tipo === "confirmar") resolver(window.confirm(`${p.titulo}\n\n${p.mensagem}`));
          else { window.alert(p.mensagem); resolver(true); }
          return;
        }
        setPendente((anterior) => {
          anterior?.resolver(false);
          return { ...p, resolver };
        });
      }),
    []
  );

  const confirmar = useCallback(
    async ({ titulo, mensagem, acao }: PedidoConfirmacao) =>
      pedir({ tipo: "confirmar", titulo, mensagem, acao: acao ?? "Confirmar" }),
    [pedir]
  );

  const avisar = useCallback(
    async (mensagem: string, titulo = "Aviso") => {
      await pedir({ tipo: "aviso", titulo, mensagem, acao: "OK" });
    },
    [pedir]
  );

  useEffect(() => {
    const dialogo = ref.current;
    if (!pendente || !dialogo || dialogo.open) return;
    dialogo.showModal();
    dialogo.querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
  }, [pendente]);

  function aoFechar() {
    const dialogo = ref.current;
    const ok = dialogo?.returnValue === CONFIRMOU;
    if (dialogo) dialogo.returnValue = "";
    pendente?.resolver(pendente.tipo === "aviso" ? true : ok);
    setPendente(null);
  }

  const confirmacao = pendente?.tipo === "confirmar";

  return (
    <Ctx.Provider value={{ confirmar, avisar }}>
      {children}
      <dialog
        ref={ref}
        className="dialogo"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-mensagem"
        onClose={aoFechar}
      >
        {pendente && (
          <form method="dialog">
            <h1 id="dialogo-titulo" className="dialogo-titulo">{pendente.titulo}</h1>
            <p id="dialogo-mensagem" className="dialogo-mensagem">{pendente.mensagem}</p>
            <div className="dialogo-acoes">
              {confirmacao && (
                <button type="submit" value="cancelar" className="btn secundario" data-foco-inicial>
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                value={CONFIRMOU}
                className={confirmacao ? "btn perigo" : "btn"}
                data-foco-inicial={confirmacao ? undefined : true}
              >
                {pendente.acao}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </Ctx.Provider>
  );
}

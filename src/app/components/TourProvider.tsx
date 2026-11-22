"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSessao } from "@/app/components/SessaoProvider";
import { jaVisitou, marcarVisitado, passosDaRota, posicionarTooltip, proximoIndice } from "@/lib/tour";

interface TourControle {
  abrirTour: () => void;
  primeiraVisita: boolean;
}

const Ctx = createContext<TourControle>({ abrirTour: () => {}, primeiraVisita: false });

export function useTour(): TourControle {
  return useContext(Ctx);
}

interface Pos { top: number; left: number; width: number; height: number }

export function TourProvider({ children }: { children: ReactNode }) {
  const { papel, email } = useSessao();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const [primeiraVisita, setPrimeiraVisita] = useState(false);
  const abriuAuto = useRef(false);
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const focarAoAbrir = useRef(false);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const passos = useMemo(() => passosDaRota(pathname, papel), [pathname, papel]);
  const focado = aberto ? (passos[indice] ?? null) : null;

  useEffect(() => {
    if (abriuAuto.current || !email || typeof window === "undefined") return;
    abriuAuto.current = true;
    if (!jaVisitou(window.localStorage, email)) {
      setPrimeiraVisita(true);
      setAberto(true);
    }
  }, [email]);

  useEffect(() => {
    if (aberto && passos.length === 0) setAberto(false);
  }, [aberto, passos.length]);

  useEffect(() => {
    if (aberto) setIndice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const abrirTour = useCallback(() => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      focoAnterior.current = document.activeElement;
    }
    focarAoAbrir.current = true;
    setAberto(true);
    setIndice(0);
  }, []);

  const fechar = useCallback(() => {
    setAberto(false);
    setPos(null);
    focarAoAbrir.current = false;
    const anterior = focoAnterior.current;
    focoAnterior.current = null;
    if (anterior?.isConnected) anterior.focus();
  }, []);

  const marcar = useCallback(() => {
    if (typeof window !== "undefined" && email) marcarVisitado(window.localStorage, email);
    setPrimeiraVisita(false);
  }, [email]);

  const encerrar = useCallback(() => {
    marcar();
    fechar();
  }, [marcar, fechar]);

  function localizar(alvo: string): Element | null {
    if (typeof document === "undefined") return null;
    try {
      return document.querySelector(alvo);
    } catch {
      return null;
    }
  }

  function medir(el: Element): Pos {
    if (typeof (el as Element & { scrollIntoView?: unknown }).scrollIntoView === "function") {
      (el as Element & { scrollIntoView: (o?: ScrollIntoViewOptions) => void }).scrollIntoView({
        block: "center",
        inline: "center",
      });
    }
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  useEffect(() => {
    if (!focado) return;
    let cancelado = false;
    let tentativas = 0;
    const tentar = () => {
      if (cancelado) return;
      const el = localizar(focado.alvo);
      if (el) {
        setPos(medir(el));
        return;
      }
      tentativas += 1;
      if (tentativas > 5) {
        const proximo = proximoIndice(passos, indice, (a) => !!localizar(a), true);
        if (proximo === null || proximo === indice) fechar();
        else setIndice(proximo);
        return;
      }
      setTimeout(tentar, 150);
    };
    const t = setTimeout(tentar, 80);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [focado, aberto, indice, passos, fechar]);

  const avancar = useCallback(() => {
    if (!aberto) return;
    if (passos.length === 0) return fechar();
    const proximo = proximoIndice(passos, indice, (a) => !!localizar(a), true);
    if (proximo === null || proximo <= indice) encerrar();
    else setIndice(proximo);
  }, [aberto, passos, indice, encerrar, fechar]);

  const voltar = useCallback(() => {
    if (!aberto || passos.length === 0) return;
    const anterior = proximoIndice(passos, indice, (a) => !!localizar(a), false);
    if (anterior !== null) setIndice(anterior);
  }, [aberto, passos, indice]);

  const visivel = Boolean(aberto && focado && pos);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!visivel || !dialogo) return;
    if (typeof dialogo.showPopover === "function") {
      if (!dialogo.matches(":popover-open")) dialogo.showPopover();
    } else if (!dialogo.open) {
      dialogo.setAttribute("open", "");
    }
    if (focarAoAbrir.current) {
      focarAoAbrir.current = false;
      dialogo.querySelector<HTMLButtonElement>(".tour-rodape button:last-child")?.focus();
    }
  }, [visivel]);

  const tooltip = useMemo(() => {
    if (!focado || !pos) return undefined;
    const viewport = typeof window !== "undefined" ? { largura: window.innerWidth, altura: window.innerHeight } : { largura: 1024, altura: 600 };
    return posicionarTooltip(pos, viewport);
  }, [focado, pos]);

  return (
    <Ctx.Provider value={{ abrirTour, primeiraVisita }}>
      {children}
      {aberto && focado && pos && tooltip && (
        <>
          <div className="tour-overlay" onClick={encerrar} />
          <div className="tour-alvo" style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }} />
          <dialog
            ref={dialogoRef}
            popover="manual"
            className="tour-tooltip"
            aria-labelledby="tour-titulo"
            style={{ top: tooltip.top, left: tooltip.left, maxWidth: tooltip.maxWidth }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                encerrar();
              }
            }}
          >
            <button type="button" className="tour-fechar" aria-label="Fechar tour" onClick={encerrar}>
              ×
            </button>
            <h2 id="tour-titulo" className="tour-titulo">{focado.titulo}</h2>
            <p>{focado.descricao}</p>
            <div className="tour-rodape">
              <span className="tour-posicao">{indice + 1}/{passos.length}</span>
              <button type="button" onClick={voltar} disabled={indice === 0}>
                Voltar
              </button>
              <button type="button" onClick={avancar}>
                {indice === passos.length - 1 ? "Concluir" : "Avançar"}
              </button>
            </div>
          </dialog>
        </>
      )}
    </Ctx.Provider>
  );
}

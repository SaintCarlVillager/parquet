"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSessao } from "@/app/components/SessaoProvider";
import { jaVisitou, marcarVisitado, passosDaRota, proximoIndice } from "@/lib/tour";

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
  const [primeiraVisita, setPrimeiraVisita] = useState<boolean>(() =>
    typeof window !== "undefined" && !!email ? !jaVisitou(window.localStorage, email) : false
  );
  const abriuAuto = useRef(false);

  const passos = useMemo(() => passosDaRota(pathname, papel), [pathname, papel]);
  const focado = aberto ? (passos[indice] ?? null) : null;

  useEffect(() => {
    if (abriuAuto.current || !email || typeof window === "undefined") return;
    abriuAuto.current = true;
    if (!jaVisitou(window.localStorage, email)) setAberto(true);
  }, [email]);

  useEffect(() => {
    if (aberto && passos.length === 0) setAberto(false);
  }, [aberto, passos.length]);

  useEffect(() => {
    if (aberto) setIndice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const abrirTour = useCallback(() => {
    setAberto(true);
    setIndice(0);
  }, []);

  const fechar = useCallback(() => {
    setAberto(false);
    setPos(null);
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

  const tooltip = useMemo(() => {
    if (!focado || !pos) return undefined;
    const largura = 300;
    const acimaDireita = typeof window !== "undefined" && window.innerWidth - (pos.left + pos.width) > largura + 24;
    if (acimaDireita) return { top: pos.top, left: pos.left + pos.width + 12, maxWidth: largura };
    const top = Math.max(8, Math.min(pos.top + pos.height + 12, (typeof window !== "undefined" ? window.innerHeight : 600) - 120));
    return { top, left: pos.left, maxWidth: largura };
  }, [focado, pos]);

  return (
    <Ctx.Provider value={{ abrirTour, primeiraVisita }}>
      {children}
      {aberto && focado && pos && tooltip && (
        <>
          <div className="tour-overlay" onClick={encerrar} />
          <div className="tour-alvo" style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }} />
          <div className="tour-tooltip" role="dialog" aria-label={focado.titulo} style={{ top: tooltip.top, left: tooltip.left, maxWidth: tooltip.maxWidth }}>
            <button type="button" className="tour-fechar" aria-label="Fechar tour" onClick={encerrar}>
              ×
            </button>
            <strong>{focado.titulo}</strong>
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
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}

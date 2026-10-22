"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { httpJson } from "@/lib/http";
import { useState } from "react";
import type { Papel } from "@/lib/auth";
import { useTour } from "@/app/components/TourProvider";

function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const links: { href: string; label: string; papeis: Papel[]; ico: React.ReactNode }[] = [
  {
    href: "/",
    label: "Dashboard",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ico>,
  },
  {
    href: "/escala",
    label: "Escala mensal",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Ico>,
  },
  {
    href: "/custodia",
    label: "Custódia",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" /><path d="M9 12l2 2 4-4" /></Ico>,
  },
  {
    href: "/promotores",
    label: "Promotores",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><circle cx="9" cy="7" r="4" /><path d="M2 21v-1a7 7 0 0 1 14 0v1" /><path d="M16 3.5a4 4 0 0 1 0 7" /><path d="M19 14.5A7 7 0 0 1 22 20v1" /></Ico>,
  },
  {
    href: "/regras",
    label: "Regras",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16" r="3.5" /><path d="M20.5 18.5 22 20" /></Ico>,
  },
  {
    href: "/portarias",
    label: "Portarias",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><path d="M6 2h9l4 4v16H6z" /><path d="M15 2v4h4" /><path d="M9 11h7M9 15h7" /><circle cx="9" cy="7" r="0.8" fill="currentColor" stroke="none" /></Ico>,
  },
  {
    href: "/trocas",
    label: "Trocas / Ajustes",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><path d="M7 7h11l-3-3M18 7l-3 3M17 17H6l3-3M6 17l3 3" /></Ico>,
  },
  {
    href: "/feriados",
    label: "Feriados",
    papeis: ["CHEFE", "OFICIAL"],
    ico: <Ico><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></Ico>,
  },
  {
    href: "/grade",
    label: "Posições",
    papeis: ["CHEFE", "OFICIAL"],
    ico: <Ico><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></Ico>,
  },
  {
    href: "/excecoes",
    label: "Exceções",
    papeis: ["CHEFE", "OFICIAL"],
    ico: <Ico><rect x="2.5" y="8" width="19" height="8" rx="4" /><circle cx="16" cy="12" r="2.6" fill="currentColor" stroke="none" /></Ico>,
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    papeis: ["CHEFE", "OFICIAL", "PROMOTOR"],
    ico: <Ico><circle cx="12" cy="12" r="3" /><path d="M19 15a7.5 7.5 0 0 0 0-6M5 9a7.5 7.5 0 0 0 0 6M9 5a7.5 7.5 0 0 1 6 0M9 19a7.5 7.5 0 0 0 6 0" /></Ico>,
  },
];

export type SessaoUi = { nome: string; papel: "CHEFE" | "OFICIAL" | "PROMOTOR"; email: string };

const ROTULO_PAPEL: Record<SessaoUi["papel"], string> = {
  CHEFE: "Oficial de Promotoria Chefe",
  OFICIAL: "Oficial de Promotoria",
  PROMOTOR: "Promotor de Justiça",
};

export default function SideNav({ nome, papel, email }: SessaoUi) {
  const pathname = usePathname();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const { abrirTour, primeiraVisita } = useTour();
  const ambiente = (process.env.NEXT_PUBLIC_AMBIENTE ?? "local") as "local" | "preview" | "production";
  const ROTULO_AMBIENTE = { local: "DEV LOCAL", preview: "PREVIEW", production: "PRODUÇÃO" }[ambiente];

  async function sair() {
    setSaindo(true);
    try { await httpJson("/api/logout", { method: "POST" }); } catch {}
    router.replace("/login");
  }

  return (
    <aside className={`sidebar${menuAberto ? " menu-aberto" : ""}`}>
      <div className="logo">
        <div className="logo-mpsp">
          <span className="mp">MP</span>
          <span className="sp">SP</span>
        </div>
        <div className="logo-divisor" />
        <div className="logo-setor">
          ESCALA DE
          <br />
          AUDIÊNCIAS
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <nav>
        {links
          .filter((l) => l.papeis.includes(papel))
          .map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""} onClick={() => setMenuAberto(false)}>
              {l.ico}
              {l.label}
            </Link>
          ))}
        {papel === "CHEFE" && (
          <Link href="/usuarios" className={pathname === "/usuarios" ? "active" : ""} onClick={() => setMenuAberto(false)}>
            <Ico><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /><path d="M19 2v4M17 4h4" /></Ico>
            Usuários e acessos
          </Link>
        )}
      </nav>
      <div className="sidebar-rodape">
        <span className={`badge-ambiente ${ambiente}`}>{ROTULO_AMBIENTE}</span>
        <div className="sessao">
          <div className="sessao-nome" title={email}>{nome}</div>
          <div className="sessao-papel">{ROTULO_PAPEL[papel]}</div>
        </div>
        <div className="sessao-acoes">
          <button
            type="button"
            className="btn-tour"
            onClick={abrirTour}
            title={primeiraVisita ? "Primeira visita — veja o tour guiado" : "Ver tour guiado"}
          >
            ?
            {primeiraVisita && <span className="tour-badge" aria-hidden>1</span>}
          </button>
          <button type="button" className="btn-sair" onClick={sair} disabled={saindo}>
            {saindo ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </aside>
  );
}

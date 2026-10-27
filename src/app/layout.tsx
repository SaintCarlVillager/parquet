import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Escala PJ Criminal" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="pular-para-conteudo" href="#conteudo-principal">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}

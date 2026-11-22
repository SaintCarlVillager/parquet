import type { Metadata } from "next";
// Astryx primeiro (camadas @layer astryx-*); globals.css fica sem camada e vence onde se sobrepoe.
// O reset global do Astryx (@astryxdesign/core/reset.css) fica de fora ate todas as telas migrarem.
import "@astryxdesign/core/astryx.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = { title: "Escala PJ Criminal" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="pular-para-conteudo" href="#conteudo-principal">
          Ir para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

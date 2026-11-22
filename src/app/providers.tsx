"use client";

import Link from "next/link";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import ptBR from "@astryxdesign/core/locales/pt-BR.generated.js";
import { defaultThemeSlug, themes } from "@/astryx-themes";

// Tema Astryx (marca MPSP; gerado em src/astryx-themes.ts por `npx astryx theme add parquet`), textos internos dos componentes em pt-BR e links do Next.
// O app e somente claro: mode="light" acompanha o color-scheme de globals.css.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <InternationalizationProvider locale="pt-BR" messages={{ "pt-BR": ptBR }}>
      <Theme theme={themes[defaultThemeSlug]} mode="light">
        <LinkProvider component={Link}>{children}</LinkProvider>
      </Theme>
    </InternationalizationProvider>
  );
}

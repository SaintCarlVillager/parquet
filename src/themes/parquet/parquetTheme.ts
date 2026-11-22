import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

// Tema Astryx do Parquet: herda o neutral e aplica a marca MPSP.
// O app e somente claro (color-scheme: light em globals.css), entao light e dark
// recebem o mesmo valor. Depois de editar: `npx astryx theme build src/themes/parquet/parquetTheme.ts`.
export const parquetTheme = defineTheme({
  name: "parquet",
  extends: neutralTheme,
  tokens: {
    "--color-accent": ["#C40008", "#C40008"],
    "--color-on-accent": ["#ffffff", "#ffffff"],
    "--color-text-accent": ["#96050F", "#96050F"],
    "--color-accent-muted": ["#fdeaea", "#fdeaea"],
    "--color-icon-accent": ["#C40008", "#C40008"],
    "--color-background-body": ["#f2f3f5", "#f2f3f5"],
    // Mesma familia do restante do app (globals.css); dispensa a fonte Figtree do neutral.
    "--font-family-body": "Arial, Helvetica, sans-serif",
    "--font-family-heading": "Arial, Helvetica, sans-serif",
  },
});

export default parquetTheme;

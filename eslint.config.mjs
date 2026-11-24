import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Saidas geradas pela CLI do Astryx (theme build / theme add): nao editar nem lintar.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "scripts/**/*.mjs", "src/themes/*/*.{js,d.ts,mjs}", "src/astryx-themes.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
];

export default config;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".claude/**",
    "next-env.d.ts",
  ]),
  // eslint-config-next 16.4 voegde React Compiler-regels toe die bestaande
  // componenten raken. Ze zijn waardevol maar geen fout: waarschuwen, en per
  // component oplossen als het bestand toch wordt aangepast (zie WP-11).
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-location-assign-relative-destination": "warn",
    },
  },
]);

export default eslintConfig;

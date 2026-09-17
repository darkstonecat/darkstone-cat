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
    "next-env.d.ts",
    // Generated audit output. It is gitignored, but flat config does not read
    // .gitignore and does lint dot-directories, so running an audit would
    // otherwise flood the next lint run with errors from bundled reports.
    "audits/**",
    ".lighthouse/**",
    "lighthouse-*",
    "coverage/**",
  ]),
  {
    // eslint-plugin-react@7.37.5 supports eslint up to ^9.7 only. Under ESLint
    // 10 its version auto-detection crashes, because detectReactVersion ->
    // resolveBasedir still calls context.getFilename(), which ESLint 10
    // removed. Declaring the version explicitly skips that code path entirely.
    // Keep this in sync with the react pin in package.json.
    settings: { react: { version: "19.3.0" } },
  },
  {
    // This directory renders JSX through Satori (via next/og) to produce a PNG.
    // Satori has no browser DOM and cannot resolve next/image, so <img> is the
    // only option here and no-img-element is a false positive.
    files: ["src/lib/event-image/**"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

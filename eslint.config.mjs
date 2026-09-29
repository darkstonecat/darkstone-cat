import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const require = createRequire(import.meta.url);

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
  // Relax rules for test files — mocks require `any` casts
  {
    files: ["tests/**/*.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Omitting a key via rest destructuring is idiomatic in mocks/fixtures.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      // next/image is mocked with a plain <img> in component tests.
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Playwright fixtures receive a callback named `use`, which the React
    // Hooks rule mistakes for React's use() hook.
    files: ["e2e/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // eslint-plugin-react@7.37.5 supports eslint up to ^9.7 only. Under ESLint
    // 10 its version auto-detection crashes, because detectReactVersion ->
    // resolveBasedir still calls context.getFilename(), which ESLint 10
    // removed. Declaring the version explicitly skips that code path entirely.
    // It is read from the installed package, so it cannot drift from the pin.
    // Drop this block, and the eslint overrides in package.json, once
    // eslint-plugin-react declares ESLint 10 support.
    settings: { react: { version: require("react/package.json").version } },
  },
  {
    // These directories render JSX through Satori (via next/og) to produce a
    // PNG. Satori has no browser DOM and cannot resolve next/image, so <img> is
    // the only option here and no-img-element is a false positive.
    files: ["src/lib/event-image/**", "src/lib/member-card/**"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;

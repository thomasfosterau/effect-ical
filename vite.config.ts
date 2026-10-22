/**
 * The one Vite+ configuration for this single-package repository: the
 * repo-wide format / lint / staged passes (read statically by `vp fmt`,
 * `vp lint` and `vp staged`), the task graph (`check`, `build`, `test:unit`,
 * `test:coverage`), the `vp pack` (tsdown) build and the Vitest settings.
 *
 * Copied from the effect-web library's root and per-package configs (itself
 * from effect-drizzle-ext and the gardeneria application) and flattened for
 * a repo whose package lives at the root: every comment that explains a
 * load-bearing decision is part of the standard and travels with the config.
 * Vite+ 1.x nests a task's `env` / `input` / `output` under `cache`.
 *
 * @copyright Thomas Foster
 */

import { defineConfig } from "vite-plus";
import { recommended } from "@effect/tsgo/oxlint-presets";
import effect from "@mpsuesser/oxlint-plugin-effect";

/**
 * Input fingerprint for the cached tasks: auto tracking minus node_modules
 * bookkeeping churn (pnpm rewrites `.modules.yaml` on every install), with
 * the lockfile back explicitly so a dependency upgrade still invalidates a
 * type-check or a test run.
 */
const cacheInputs = [{ auto: true }, "!node_modules/**", "pnpm-lock.yaml"];

const maxWorkers = process.env.VITEST_MAX_WORKERS;

export default defineConfig({
  // Staged-file checks run by `vp staged` (pre-commit).
  staged: {
    "*.{js,ts,css,json,md}": "vp check --fix",
  },
  fmt: {
    // CHANGELOG.md is written by `changeset version` and never hand-edited,
    // so the formatter leaves it as Changesets wrote it.
    ignorePatterns: ["**/dist/**", "**/coverage/**", "**/CHANGELOG.md"],
    overrides: [
      {
        files: ["**/*.md"],
        options: {
          proseWrap: "never",
        },
      },
    ],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/coverage/**", "**/node_modules/**"],
    extends: [recommended, effect.configs.recommended],
    categories: {
      correctness: "error",
    },
    rules: {
      "eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "eslint/prefer-const": "warn",
      // The `Buffer` global is typed `any` wherever a consumer loads
      // @cloudflare/workers-types next to @types/node, so every call on it is
      // unchecked there. Use Uint8Array / TextEncoder / DataView instead.
      "eslint/no-restricted-globals": [
        "error",
        {
          name: "Buffer",
          message:
            "The `Buffer` global is typed `any` wherever @cloudflare/workers-types is loaded. Use Uint8Array / TextEncoder / DataView.",
        },
      ],
      // `casting-awareness` is an awareness prompt, not a defect rule — it
      // fires on every `as`. Stays visible as a warning.
      "effect/casting-awareness": "warn",
      // Hard-codes abbreviations (`Arr`, `P`, `R`, …) with no options, so it is
      // unsatisfiable under the full-name convention (`import * as Option from
      // "effect/Option"`) this family shares with its consumers.
      "effect/prefer-namespace-imports": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      // This file is evaluated by Vite and Vitest in bare Node, before any
      // Effect runtime exists — there is no `Config` provider to read from,
      // so `process.env` is the only thing that works here.
      {
        files: ["vite.config.ts"],
        rules: {
          "effect/avoid-process-env": "off",
          // `...(process.env.X ? { x } : {})` is how a vitest option is left
          // unset under `exactOptionalPropertyTypes`.
          "effect/no-conditional-empty-object-spread": "off",
        },
      },
      // `tests/helpers/effect.ts` IS the test harness boundary
      // `effect-run-in-body` names as the place to run an Effect, and each
      // example script is an entrypoint whose last line runs its program.
      {
        files: ["tests/helpers/effect.ts", "examples/*.ts"],
        rules: {
          "effect/effect-run-in-body": "off",
        },
      },
    ],
    // Type-aware linting is intentionally disabled: type checking stays the
    // `check` task's job (native tsc, Effect-patched).
    options: {
      typeAware: false,
      typeCheck: false,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  run: {
    tasks: {
      // The CI type gate: native TS7 `tsc` (patched by @effect/tsgo, so it
      // also reports Effect diagnostics) over `src` (`tsconfig.json`), then
      // over `src`, `tests` and `examples` (`tsconfig.test.json`), so the
      // examples the README points at keep compiling against the API.
      check: {
        command: "tsc -p tsconfig.json && tsc -p tsconfig.test.json",
        cache: { input: cacheInputs, output: [] },
      },
      // Runs every example script under `examples/` (tsx), so the scripts the
      // README points at are proved to run, not only to type-check.
      examples: {
        command: "tsx examples/basic.ts && tsx examples/builder.ts && tsx examples/effect-api.ts",
        cache: { input: cacheInputs, output: [] },
      },
      // The published artifact: one ESM bundle + declaration file
      // (`vp pack` → tsdown). `sideEffects: false` is a claim about this
      // output: no top-level statements.
      build: {
        command: "vp pack",
        cache: { input: cacheInputs, output: ["dist/**"] },
      },
      "test:unit": {
        command: "vp test run",
        cache: { env: ["VITEST_MAX_WORKERS", "NODE_OPTIONS"], input: cacheInputs, output: [] },
      },
      // The suite under Istanbul, writing `coverage/coverage-final.json`,
      // which `fallow audit` reads for exact per-function CRAP scores
      // (`health.coverage` in .fallowrc.json). Without it fallow estimates
      // every function as uncovered. Run this before `fallow audit` (the
      // Claude Code PreToolUse fallow gate runs the audit on `git commit` /
      // `git push` but never refreshes this map). Fails if coverage drops
      // below the thresholds in `test.coverage` below.
      "test:coverage": {
        command: "vp test run --coverage",
        cache: {
          env: ["VITEST_MAX_WORKERS", "NODE_OPTIONS"],
          input: cacheInputs,
          output: ["coverage/**"],
        },
      },
    },
  },
  pack: {
    entry: { index: "src/index.ts" },
    format: "esm",
    platform: "neutral",
    // The tsup build this replaced targeted es2022; untranspiled `esnext`
    // is the family standard (consumers' bundlers lower it).
    target: "esnext",
    dts: true,
    outDir: "dist",
    clean: true,
    deps: {
      // `effect` stays external so the published package shares the
      // consumer's singleton copy.
      neverBundle: [/^effect(\/|$)/],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    ...(maxWorkers === undefined ? {} : { maxWorkers: Number(maxWorkers) }),
    coverage: {
      provider: "istanbul",
      // `json` writes coverage-final.json, the Istanbul map `fallow audit`
      // reads (see `test:coverage` above).
      reporter: ["text-summary", "json-summary", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["**/*.d.ts"],
      // effect-web's thresholds, the family standard. Never lower one to make
      // a change pass: add the tests instead.
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});

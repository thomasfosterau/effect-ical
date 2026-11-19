import { defineConfig } from "vite-plus";
import { recommended } from "@effect/tsgo/oxlint-presets";
import effect from "@enfect/oxlint";

// Auto tracking minus node_modules churn, with the lockfile back so a
// dependency upgrade still invalidates cached tasks.
const cacheInputs = [{ auto: true }, "!node_modules/**", "pnpm-lock.yaml"];

export default defineConfig({
  staged: {
    "*.{js,ts,css,json,md}": "vp check --fix",
  },
  fmt: {
    // Written by Changesets.
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
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "vitest", "jsdoc"],
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
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
      "vite-plus/prefer-vite-plus-imports": "error",
      // `@category` is used on every export.
      "jsdoc/check-tag-names": ["error", { definedTags: ["category"] }],
      // `_tag` is Effect's discriminant (tagged errors, `Result`, `Option`),
      // so a leading or trailing underscore is the library's naming, not a
      // private marker.
      "eslint/no-underscore-dangle": "off",
      // The setters copy a Schema class instance's fields into its own
      // constructor (`new Event({ ...event, summary })`), and the tests spread
      // instances into plain records on purpose: the dropped prototype is the
      // point, and `new` restores it in `src/`.
      "typescript/no-misused-spread": "off",
    },
    overrides: [
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
    // `typeCheck` is off: the `check` task (Effect-patched native tsc) is the
    // type gate, and would only be run twice.
    options: {
      typeAware: true,
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
      // Everything CI runs, in order. `vp run ci` locally is the same run.
      ci: {
        command:
          "vp check && vp run check && vp run test:coverage && vp run build && pnpm audit --audit-level high",
        cache: false,
      },
      // Run by the pre-commit hook; reads the coverage map.
      "fallow:audit": {
        command: "vp exec fallow audit --base origin/trunk --quiet",
        dependsOn: ["test:coverage"],
        cache: false,
      },
      "changeset:version": {
        command: "changeset version && vp fmt",
        cache: false,
      },
      "changeset:publish": {
        command: "changeset publish",
        dependsOn: ["build"],
        cache: false,
      },
      // Effect-patched native tsc over `src`, then `src` + `tests` + `examples`.
      check: {
        command: "tsc -p tsconfig.json && tsc -p tsconfig.test.json",
        cache: { input: cacheInputs, output: [] },
      },
      build: {
        command: "vp pack",
        cache: { input: cacheInputs, output: ["dist/**"] },
      },
      "test:unit": {
        command: "vp test run",
        cache: { env: ["VITEST_MAX_WORKERS", "NODE_OPTIONS"], input: cacheInputs, output: [] },
      },
      // Also writes coverage/coverage-final.json, which `fallow audit` reads.
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
    entry: {
      index: "src/index.ts",
      Calendar: "src/Calendar.ts",
      ContentLine: "src/ContentLine.ts",
      Event: "src/Event.ts",
      Todo: "src/Todo.ts",
      VCard: "src/VCard.ts",
    },
    format: "esm",
    platform: "neutral",
    target: "esnext",
    dts: true,
    outDir: "dist",
    clean: true,
    deps: {
      neverBundle: [/^effect(\/|$)/],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text-summary", "json-summary", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "examples/**/*.ts"],
      exclude: ["**/*.d.ts"],
      thresholds: {
        "src/**": {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
      },
    },
  },
});

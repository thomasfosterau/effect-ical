# AGENTS.md

`CLAUDE.md` is a symlink to this file. This repo publishes one package, `@thomasfosterau/effect-ical`: iCalendar (RFC 5545) encoding and decoding for Effect. The package lives at the repo root (no workspace packages).

**Toolchain:** the Vite+ library standard the sibling libraries share, copied from effect-web: `vp` runs every task, `vp check` is the format (Oxfmt) and lint (Oxlint with the Effect preset) gate, `vp pack` (tsdown) builds, tests import from `vite-plus/test`, and the fallow gate runs before every agent commit and push.

| Package | Directory | Purpose · peers |
| --- | --- | --- |
| `@thomasfosterau/effect-ical` | `.` (`src/`) | Parse, encode and build iCalendar data: a plain object model (`VCalendar`, …) with `parse` / `encode`, fluent builders, and pipeable `Calendar` / `Event` / `Todo` Schema-class modules · `effect` |

`src/` modules and their boundaries:

- `types.ts`: the plain object model (`VCalendar`, `VEvent`, `VTodo`, `VJournal`, `VFreeBusy`, `VTimezone`, `VAlarm`). Types only.
- `parser.ts`: text → `VCalendar` (`parseResult`, `parse`, `ParseError`). Pure; values are kept verbatim (no unescaping, no date decoding).
- `encoder.ts`: `VCalendar` → text (`encodeResult`, `encode`, `encodeSync`, `EncodeError`). Pure; escapes TEXT values, folds at 75 octets, CRLF.
- `builder.ts`: mutable fluent builders over the object model (`createCalendar`, `createEvent`, `createTodo`, `BuildError`).
- `Calendar.ts`, `Event.ts`, `Todo.ts`: Schema classes with pipeable setters, re-exported from `index.ts` as namespaces (`export * as Event`). `Calendar.encode` / `Calendar.decode` are a compact rendering and a shallow reader, not the full codec: see their doc comments.

## Common pitfalls

- **Behaviour is pinned by a golden file.** `tests/characterisation.test.ts` asserts the output of every input in `tests/fixtures/corpus.ts` against `tests/fixtures/corpus.golden.json`, generated from the pre-migration (Effect 3) sources. A failure there is a behaviour change: fix the code, or, for a deliberate change, edit that golden entry by hand, say why in `corpus.ts`'s header and add a changeset. Never regenerate the whole file to get green.
- **The parser's quirks are part of its contract.** A failed (e.g. unclosed) child component is skipped and its lines re-scanned as the parent's own; an `END:X` that does not match the open component is kept as a property; numeric properties that are not integers stay text. The corpus covers each.
- **No loops, no recursion over lines.** The line scanner is `Arr.unfold` (linear, stack-safe); recursion happens only per nesting level. A calendar with tens of thousands of lines must still parse.
- **`effect` is a singleton.** The package declares it as a peer (`catalog:peers`, floor `>=4.0.0-rc.118`, the first rc after the `effect/unstable/*` path move), takes it as a `catalog:` devDependency, and `overrides: { effect: "catalog:" }` forces one copy.
- **`@effect/tsgo`, `@typescript/native`, `typescript` and `vite-plus` bump together.** `effect-tsgo patch --typescript --oxlint` (the `prepare` script) supports an explicit set of TypeScript and oxlint versions and fails `pnpm install` on any other; `vite-plus` pins its `oxlint`, `oxfmt` and `vitest`, so `vite`, `vitest` and `@vitest/coverage-istanbul` follow it. Read the catalog comments before bumping any of them.
- **Strict catalog.** Every external version lives in `pnpm-workspace.yaml` (`catalogMode: strict`); `package.json` carries only `catalog:` and `catalog:peers`. After editing the catalog, run `pnpm install` and commit `pnpm-lock.yaml`, or CI fails at `pnpm install --frozen-lockfile`.
- **`minimumReleaseAge`** holds a newly published version for a day before `pnpm install` takes it (Dependabot's `cooldown` mirrors it); `@thomasfosterau/*` is exempt.
- **Node and pnpm only.** No npm, npx, bun or yarn in scripts, hooks, workflows or docs.

## Conventions

- **`exactOptionalPropertyTypes` is on.** The object model's optional members are `?: T` (no `| undefined`, which the `prefer-option-over-null` lint rule flags); build objects without explicit-`undefined` keys.
- **Pure core, Effect wrapper.** Parsing and encoding are `Result`-returning functions (`parseResult`, `encodeResult`); the Effect API wraps them with `Effect.suspend(() => Effect.fromResult(…))`, so the work runs when the Effect runs. Never call `Effect.runSync` in `src/`.
- **Errors are `Schema.TaggedError` classes** with a `message` field: `ParseError`, `EncodeError`, `BuildError`.
- **Imports:** namespace imports per module (`import * as Arr from "effect/Array"`), never the `effect` barrel.
- **Doc comments put the description first**, then tags (`@module`, `@category`, `@example`). Hovers show only the text before the first tag. Every exported symbol has one whose first sentence stands alone.
- **Format and lint:** `vp check` runs Oxfmt and Oxlint (config in `vite.config.ts`: `@effect/tsgo`'s `recommended` preset plus `@mpsuesser/oxlint-plugin-effect`'s, rule set copied from effect-web). There are no ported-code allowances: every preset rule is at `error` except the family's awareness rule `casting-awareness` (`warn`; the parser's one documented cast) and `prefer-namespace-imports` (`off`: unsatisfiable under full-name imports). `effect-run-in-body` is off only for `tests/helpers/effect.ts` (the test harness) and `examples/*.ts`.
- **Tests:** `vite-plus/test` (never `vitest`; the `vite-plus/prefer-vite-plus-imports` rule enforces it). Run Effects only through `tests/helpers/effect.ts`. `tests/examples.test.ts` runs every example. Coverage thresholds (90 / 85 / 90 / 90 on `src/**`, effect-web's) fail `vp run test:coverage`; never lower them, add tests.
- **Builds:** `vp pack` → `dist/index.js` + `dist/index.d.ts`, ESM only, `effect/*` external, `sideEffects: false` (no top-level statements).

## Commands

- `pnpm install`: dependencies (pnpm 11, pinned by `packageManager`), the Vite+ git hooks (`vp config`; pre-commit runs `vp staged`: format + lint on staged files) and the `prepare` step that patches the native `tsc` and `oxlint` with `@effect/tsgo`. No pre-push hook: run the gates yourself.
- `vp check`: format + lint. `vp check --fix` applies fixes. `vp run check`: the type gate (native TS7 `tsc` over `tsconfig.json`, then `tsconfig.test.json`, which adds `tests` and `examples`). They are different commands.
- `vp run test:unit`: the unit suite.
- `vp run test:coverage`: the suite under Istanbul, failing below the thresholds; writes `coverage/coverage-final.json`, which `fallow audit` reads.
- `vp run build`: `vp pack` → `dist/`.
- `pnpm audit --audit-level high`: the dependency audit CI runs (network).
- `pnpm changeset`: add a changeset.

`vp` is `node_modules/.bin/vp`; the SessionStart hook puts it on PATH. The only non-`vp` invocations are `pnpm install`, `pnpm audit` and `pnpm changeset` / `pnpm publish` on the release path.

## Verification

Before you report work as done, run the gates below in order and quote each command with its final pass/fail. If a gate can't run here, say which and why; never imply it ran.

1. From a clean install, which is what CI sees: `rm -rf node_modules dist coverage && pnpm install --frozen-lockfile`
2. `vp check`
3. `vp run check`
4. `vp run test:unit`
5. `vp run test:coverage`
6. `vp run build`
7. `pnpm audit --audit-level high` (network)
8. `fallow audit --format json --quiet --explain --gate-marker agent --base origin/trunk` (the fallow gate below; not a CI step), which reads the map step 5 wrote. The verdict must not be `fail`.

Steps 2–7 are CI's `ci` job, in its order ([ci.yml](.github/workflows/ci.yml)).

## Branches and pull requests

- **Branch off `trunk`; PR against `trunk`; squash-merge with a conventional prefix** (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`). `trunk` is the default branch; there is no `main`. Rebase onto `origin/trunk` before opening or updating a PR; never merge `trunk` into your branch.
- **Changesets.** Every change to the published package's behaviour or its emitted `.d.ts` carries a changeset (`pnpm changeset`); a doc-comment change is a `patch`; docs-, CI- and tooling-only changes need none. Never publish or version by hand: the Release workflow opens the version PR (`chore: version packages`) and the owner merges it. See [PUBLISHING.md](PUBLISHING.md).
- **No standing PR approval.** Push your branch; open a PR only when asked.
- **GitHub scope.** GitHub writes go to `thomasfosterau/effect-ical` only. Read other repos (the sibling libraries) for reference only.

## Work tracker

GitHub issues are the backlog: when you find work you can't do now, file an issue rather than leaving a TODO. The issue is the spec; later comments override the body. Re-verify an issue's claims against current `trunk` before acting on it. Record decisions as issue comments.

## Effect

Never guess at an Effect API: read the installed package. The pinned version is the `effect` entry in `pnpm-workspace.yaml`'s catalog; its declarations are in `node_modules/effect/dist/*.d.ts`, its source in `node_modules/effect/src`. Effect 4 names to know: `Result` (not `Either`), `Effect.result` / `Effect.fromResult`, `Schema.Literals([...])`, `Schema.TaggedError<Self>()(tag, fields)`, `Effect.catch` (not `catchAll`).

## Agent sessions

- The SessionStart hook (`.claude/hooks/session-start.sh`, registered in `.claude/settings.json`) runs `pnpm install --frozen-lockfile` (through Corepack when available), which also applies the tsgo patch, and puts `vp` (a re-exec shim preferring the nearest checkout's `node_modules`) and `fallow` on PATH. It hydrates no secrets; nothing here needs one.
- A PreToolUse hook (`.claude/hooks/fallow-gate.sh`) blocks `git commit` / `git push` when `fallow audit --base origin/trunk` fails; it reads the coverage map on disk, so run `vp run test:coverage` first. A PostToolUse hook runs `vp fmt` on every source, JSON, CSS or Markdown file you write or edit.

## Documentation surfaces

- `README.md`: the landing page and the npm-facing API reference. Every example in it must compile against the current API.
- `examples/*.ts`: runnable programs, executed by `tests/examples.test.ts`.
- `CONTRIBUTING.md` (human setup), `SECURITY.md` (reporting, supply chain), `PUBLISHING.md` (release pipeline and the owner's one-time setup).
- This file: agent guidance. Decisions go in issue comments.

---

## Fallow local gate

Before any `git commit` or `git push`, run `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking. Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. The config is `.fallowrc.json`: a new published entry point joins its `entry` list.

## Fallow task map

| When the agent is about to... | Run |
| --- | --- |
| delete an "unused" export or file | `fallow dead-code --trace <file>:<export>` |
| delete an "unused" dependency | `fallow dead-code --trace-dependency <name>` |
| commit or open a PR | `fallow audit --base <ref>` |
| check which architecture rules apply to a file before changing it | `fallow guard <files>` |
| understand a finding | `fallow explain <issue-type>` |

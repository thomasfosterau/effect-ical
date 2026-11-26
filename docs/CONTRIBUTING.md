# Contributing

## Workflow

- Branch off `trunk` and open a pull request into `trunk`; never commit to `trunk` directly. Open a draft PR as soon as you start, and keep one PR per change, however large. Squash-merge with a conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`). Rebase onto `origin/trunk` rather than merging it in.
- File an issue for anything you notice that is out of scope, and keep issue bodies evergreen: edit the body as understanding improves rather than appending comments.
- Dependabot keeps dependencies current. Its `toolchain` group needs hand edits, made in a PR from a new branch started from Dependabot's head (never push to a `dependabot/*` branch, which stops it rebasing; it closes its own PR once yours merges): the npm-alias catalog entries (`vite` must equal `vite-plus`; `typescript` / `@typescript/native` must be a pair `@effect/tsgo` supports), an `@effect/tsgo` release that supports the new oxlint, and the devcontainer image tag.

## Toolchain

[Vite+](https://viteplus.dev) (`vp`) manages Node and pnpm and runs every task. `vp install` installs dependencies, the git hooks (pre-commit runs `vp staged`, then `vp run fallow:audit`) and, through `prepare`, the Effect-patched `tsc` and oxlint.

| Command | What it does |
| --- | --- |
| `vp check` | Format (Oxfmt) and lint (Oxlint with the Effect presets, type-aware) |
| `vp run check` | Type gate: Effect-patched native `tsc` over `src`, then `src` + `tests` + `examples` |
| `vp run test:unit` | Unit tests |
| `vp run test:coverage` | Tests with coverage thresholds; writes the map `fallow audit` reads |
| `vp run build` | `vp pack` → `dist/` |
| `vp run ci` | Everything CI runs, in order (`pnpm audit` needs the network) |
| `vp run fallow:audit` | Fallow on your change (dead code, duplication, complexity); the pre-commit hook runs it |

Fallow is a guide, not dogma: use it to polish your work, but some duplication or complexity is fine. Every external version lives in the `pnpm-workspace.yaml` catalog; never edit one in `package.json`.

## Coding guidelines

- Use Effect idioms throughout, and strongly prefer Effect v4's own modules (`Array`, `Option`, `Result`, `Match`, `Schema`, …) over hand-rolled equivalents; convert existing code where practical. Exceptions: non-Effect APIs adapted at the edge, and hot paths where measured performance needs plain code. File an issue for non-idiomatic code you find rather than leaving it.
- Read the installed `effect` package (`node_modules/effect`) rather than guessing at an API. Parsing and encoding are pure `Result` functions; the Effect API wraps them. Errors are `Schema.TaggedError` classes. Import Effect modules as namespaces (`import * as Arr from "effect/Array"`), never from the barrel.
- Exports follow Effect's layout: `src/index.ts` re-exports each PascalCase module as a namespace (`export * as Event from "./Event.js"`), and each is also importable from its own PascalCase subpath (`@thomasfosterau/effect-ical/Event`), listed in `exports` and the `pack` entries.
- `exactOptionalPropertyTypes` is on: optional members are `?: T`, and objects are built without explicit-`undefined` keys.
- Fix lint findings in code; a rule is relaxed only in `vite.config.ts`, with its reason.
- Comments: a short file header only where it adds context; doc comments on exports where they add to IntelliSense (description first, then tags); inline comments only for the non-obvious. No references to issues, PRs or history.
- Tests import from `vite-plus/test` and run Effects through `tests/helpers/effect.ts`. Test logic and edge cases, not what the type system already checks. Don't lower the coverage thresholds; add tests.
- `tests/characterisation.test.ts` pins behaviour against `tests/fixtures/corpus.golden.json`. A failure there is a behaviour change: fix the code, or edit that golden entry by hand for a deliberate change. Never regenerate the whole file.

## Before pushing

Run `vp run ci` (or each of `vp check`, `vp run check`, `vp run test:coverage`, `vp run build`). The pre-commit hook runs `vp staged` (format and lint) and then `vp run fallow:audit`, which blocks the commit on findings the change introduces.

CI ([ci.yml](../.github/workflows/ci.yml)) runs `vp run ci` on Node `lts` and `latest`, with no secrets. Workflows pin actions by exact tag, locked to commits by `.github/workflows/actions.lock`: run `gh actions-lock` after changing a `uses:`. `uvx zizmor --offline .github` audits the workflows.

## Dependencies

Dependabot ([dependabot.yml](../.github/dependabot.yml)) opens `@thomasfosterau/*` updates daily and every other update weekly, on Wednesday morning Melbourne time: the named runtime sets (`effect` and the like) each in one PR, and every other development dependency in the single `toolchain` group. Security updates skip the schedule and open as soon as an advisory lands, one PR each. Vite+ selects Node.js from `.node-version` and pnpm from `packageManager`; pnpm's own switching is off (`runtimeOnFail` / `pmOnFail`), so one version of each is installed and used.

## Changesets

Every change to the published package's behaviour or its `.d.ts` (doc comments included, as a `patch`) needs a changeset: `vp exec changeset`. Docs-, CI- and tooling-only changes need none. Never version or publish by hand: the Release workflow opens the `chore: version packages` PR, and merging it publishes (`vp run release`; `vp run release:dry-run` shows what it would publish). See [PUBLISHING.md](PUBLISHING.md).

# Contributing

## Workflow

- Branch off `trunk` and open a pull request into `trunk`; never commit to `trunk` directly. Open a draft PR as soon as you start, and keep one PR per change, however large. Squash-merge with a conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`). Rebase onto `origin/trunk` rather than merging it in.
- File an issue for anything you notice that is out of scope, and keep issue bodies evergreen: edit the body as understanding improves rather than appending comments.
- Dependabot keeps dependencies current. Its `toolchain` group needs hand edits on the same branch: the npm-alias catalog entries (`vite` must equal `vite-plus`; `typescript` / `@typescript/native` must be a pair `@effect/tsgo` supports), an `@effect/tsgo` release that supports the new oxlint, and the devcontainer image tag.

## Toolchain

[Vite+](https://viteplus.dev) (`vp`) manages Node and pnpm and runs every task. `vp install` installs dependencies, the git hooks (pre-commit runs `vp staged`: format and lint on staged files) and, through `prepare`, the Effect-patched `tsc` and oxlint.

| Command | What it does |
| --- | --- |
| `vp check` | Format (Oxfmt) and lint (Oxlint with the Effect presets, type-aware) |
| `vp run check` | Type gate: Effect-patched native `tsc` over `src`, then `src` + `tests` + `examples` |
| `vp run test:unit` | Unit tests |
| `vp run test:coverage` | Tests with coverage thresholds; writes the map `fallow audit` reads |
| `vp run build` | `vp pack` → `dist/` |
| `vp run ci` | Everything CI runs, in order (`pnpm audit` needs the network) |
| `vp exec fallow audit --base origin/trunk` | Dead code, duplication and complexity in your change |

Fallow is a guide, not dogma: use it to polish your work, but some duplication or complexity is fine. Every external version lives in the `pnpm-workspace.yaml` catalog; never edit one in `package.json`.

## Coding guidelines

- Use Effect 4 idioms and read the installed `effect` package (`node_modules/effect`) rather than guessing at an API. Parsing and encoding are pure `Result` functions; the Effect API wraps them. Errors are `Schema.TaggedError` classes. Import Effect modules as namespaces (`import * as Arr from "effect/Array"`), never from the barrel.
- `exactOptionalPropertyTypes` is on: optional members are `?: T`, and objects are built without explicit-`undefined` keys.
- Fix lint findings in code; a rule is relaxed only in `vite.config.ts`, with its reason.
- Comments: a short file header only where it adds context; doc comments on exports where they add to IntelliSense (description first, then tags); inline comments only for the non-obvious. No references to issues, PRs or history.
- Tests import from `vite-plus/test` and run Effects through `tests/helpers/effect.ts`. Test logic and edge cases, not what the type system already checks. Don't lower the coverage thresholds; add tests.
- `tests/characterisation.test.ts` pins behaviour against `tests/fixtures/corpus.golden.json`. A failure there is a behaviour change: fix the code, or edit that golden entry by hand for a deliberate change. Never regenerate the whole file.

## Before pushing

Run `vp run ci` (or each of `vp check`, `vp run check`, `vp run test:coverage`, `vp run build`), and `vp exec fallow audit --base origin/trunk` after `vp run test:coverage`.

CI ([ci.yml](../.github/workflows/ci.yml)) runs `vp run ci` with no secrets. Workflows pin actions by exact tag, locked to commits by `.github/workflows/actions.lock`: run `gh actions-lock` after changing a `uses:`. `uvx zizmor --offline .github` audits the workflows.

## Changesets

Every change to the published package's behaviour or its `.d.ts` (doc comments included, as a `patch`) needs a changeset: `pnpm changeset`. Docs-, CI- and tooling-only changes need none. Never version or publish by hand: the Release workflow opens the `chore: version packages` PR, and merging it publishes. See [PUBLISHING.md](PUBLISHING.md).

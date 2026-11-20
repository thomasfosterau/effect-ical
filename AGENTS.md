# AGENTS.md

Read [README.md](README.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) first; this file adds only what is specific to agents.

## Process

- You may open pull requests in this repository (GitHub MCP tools or `gh`, whichever is available). GitHub writes go to `thomasfosterau/effect-ical` only.
- When you spot work outside your task, file an issue and move on.
- Write idiomatic Effect (see docs/CONTRIBUTING.md). Non-idiomatic code you find: fix it if trivial, otherwise file an issue naming the sites and the idiomatic replacement.
- Before reporting work as done, run the gates in docs/CONTRIBUTING.md and say which passed and which couldn't run.

## Pitfalls

- **The golden file is the behaviour contract.** See docs/CONTRIBUTING.md; never regenerate `tests/fixtures/corpus.golden.json` wholesale.
- **The parser's quirks are deliberate.** A failed (e.g. unclosed) child component is skipped and its lines re-scanned as the parent's own; an `END:X` that does not match the open component is kept as a property; non-integer numeric properties stay text.
- **No loops or recursion over lines.** The line scanner is `Arr.unfold` (linear, stack-safe); recursion happens only per nesting level, so very large calendars still parse.
- **`effect-tsgo patch` is version-locked.** `@effect/tsgo`, `@typescript/native` and `vite-plus` move together, or `vp install` fails; read the catalog comments first.
- **`sideEffects: false`**: no top-level statements in `src/`.
- **Publish only through the Release workflow** (`vp run release`; there is no publish script). Release-path registry calls go through `vp pm`, never `npm` / `pnpm` directly; `vp pm view` fails inside this repo (`devEngines.runtime` is `lts`), so rely on `vp pm publish -r` skipping published versions.

## Fallow

The pre-commit hook runs `vp run fallow:audit`; fix the findings your change introduces. Before deleting "unused" code, trace it: `vp exec fallow dead-code --trace <file>:<export>`.

`vp install` links the `fallow` skill into `.claude/skills/fallow` from the installed package (approved under `permissions` in `pnpm-workspace.yaml`).

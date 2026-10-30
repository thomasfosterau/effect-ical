# Contributing

Maintained by Thomas Foster, with a workflow meant to be approachable for both humans and coding agents. Conventions, pitfalls and the full gate list are in [AGENTS.md](AGENTS.md).

## Setup

You need Node 22 or later and pnpm 11 (pinned by `packageManager`; `corepack enable` picks it up). npm, npx, bun and yarn are not used anywhere in this repo.

```sh
pnpm install
```

The install also runs the `prepare` step: `vp config` installs the Vite+ git hooks, and `effect-tsgo patch --typescript --oxlint` patches the native `tsc` and the `oxlint` that `vite-plus` carries so they report Effect diagnostics. Every task then runs through `vp` (`node_modules/.bin/vp`; `pnpm exec vp` works if it isn't on your PATH).

## Branches

Branch off `trunk`, rebase rather than merge, squash-merge with a conventional prefix: see [AGENTS.md](AGENTS.md#branches-and-pull-requests).

## Git hooks

Hooks are managed by Vite+; the editable [.vite-hooks/pre-commit](.vite-hooks/pre-commit) is committed. **pre-commit** runs `vp staged` (format + lint on staged files). There is no pre-push hook: run the gates yourself.

## CI expectations

[ci.yml](.github/workflows/ci.yml) runs one `ci` job whose steps are the gate list in [AGENTS.md](AGENTS.md#verification). The workflows are hardened for Dependabot and other PRs: top-level `permissions: {}`, per-job least privilege, SHA-pinned actions, no persisted checkout token on PR jobs, no secrets or OIDC on anything a PR can trigger (the release job also refuses a `dependabot[bot]` actor), and `zizmor .github` (configured by `.github/zizmor.yml`) reports no warning or error. [release.yml](.github/workflows/release.yml) runs changesets/action on `trunk`: it opens the version PR while unreleased changesets exist and publishes once it merges, via npm trusted publishing (see [PUBLISHING.md](PUBLISHING.md)).

## Pre-PR checklist

1. The gates in [AGENTS.md](AGENTS.md#verification), each with its final pass/fail.
2. A changeset (`pnpm changeset`) for any change to the package's behaviour or its `.d.ts`.
3. `git fetch origin trunk && git rebase origin/trunk`
4. Docs: `README.md` for any exported change (its examples must compile), the doc comment on every new export.

## Running individual checks

```sh
vp check                              # format + lint (Oxfmt + Oxlint)
vp check --fix                        # apply the fixes
vp run check                          # the type gate (src, then src + tests + examples)
vp run test:unit                      # unit tests
vp test run tests/ical.test.ts        # one file
vp run test:coverage                  # coverage thresholds; writes coverage/coverage-final.json
vp run build                          # emit dist/
fallow audit                          # dead code, duplication, complexity (run test:coverage first)
```

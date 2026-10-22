# Publishing

Versions and changelogs are managed by [Changesets](https://github.com/changesets/changesets); publishing is npm trusted publishing (OIDC) from the protected `release` environment. There is no `NPM_TOKEN`.

## Release flow

1. A PR that changes the package's behaviour or its `.d.ts` adds a changeset (`pnpm changeset`) and merges into `trunk`.
2. The `Release` workflow ([release.yml](.github/workflows/release.yml)) runs on every push to `trunk`. While changesets are pending, it opens or updates the version PR (`chore: version packages`), which bumps the version and writes `CHANGELOG.md`.
3. The owner approves the version PR's pending CI run (**Approve and run**: runs on commits by `github-actions[bot]` wait for approval), waits for it to pass, then merges it. The next `Release` run builds (`vp run build`) and publishes with `changeset publish`, which runs `pnpm publish`; pnpm 11 publishes natively and performs the trusted-publishing (OIDC) exchange itself.
4. With no pending changesets, a version not yet on npm is published; one already on the registry is skipped, so a no-op run is green.

Never publish or version by hand. A local `changeset publish` has no credentials and fails: only the release job's GitHub OIDC token (`id-token: write`) can be exchanged for publish credentials.

**Provenance:** nothing requests it. npm attaches provenance under trusted publishing only for a public repository, and this one is private. Never add `--provenance` or `NPM_CONFIG_PROVENANCE=true`: an explicit provenance request from a private repository fails the publish.

## Release job hardening

- **`pnpm install --frozen-lockfile --ignore-scripts`.** No dependency's install script runs in the job. It also skips the repo's `prepare` (`vp config` and the `effect-tsgo` patch), which the release path does not need.
- **Job env `pnpm_config_verify_deps_before_run: "false"`.** pnpm 11 otherwise re-installs, with scripts, when a manifest looks newer than the install (as after the Changesets action resets `changeset-release/trunk`), undoing `--ignore-scripts`.
- **No check or test step.** CI runs every gate on each PR into `trunk` and each push to `trunk`; the job only installs, then versions or builds and publishes.

## One-time owner setup

1. **Rename the default branch to `trunk`** (Settings → Branches), if it is still `main`. Every workflow, `.changeset/config.json` and `.github/dependabot.yml` target `trunk`, so CI and releases do not run until this is done.
2. On npmjs.com, for `@thomasfosterau/effect-ical`: Settings → Trusted Publisher → GitHub Actions, repository `thomasfosterau/effect-ical`, workflow `release.yml`, environment `release`. The package has never been published; if npm does not yet let you bind a trusted publisher to an unpublished name, follow npm's guidance for a first publish before merging the first version PR. Until the binding exists, the publish step fails auth.
3. In the repository settings, Environments → `release`: add required reviewers so every release is manually approved. GitHub creates the environment on first use.
4. Settings → Actions → General: allow GitHub Actions to create and approve pull requests, or the version PR cannot be opened.

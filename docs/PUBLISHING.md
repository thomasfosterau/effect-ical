# Publishing

[Changesets](https://github.com/changesets/changesets) manages versions and changelogs; publishing is npm trusted publishing (OIDC) from the protected `release` environment. There is no `NPM_TOKEN`.

## Release flow

1. A PR with a changeset merges into `trunk`.
2. The Release workflow ([release.yml](../.github/workflows/release.yml)) opens or updates the `chore: version packages` PR, which bumps the version and writes `CHANGELOG.md`.
3. The owner approves that PR's CI run (runs on `github-actions[bot]` commits wait for approval), then merges it. After the `release` environment's approval, the next Release run runs `vp run release`: the build, then `vp pm publish -r --access public --no-git-checks -- --ignore-scripts` (pnpm publishes the version if npm doesn't have it yet, doing the OIDC exchange itself; a re-run publishes nothing), then `changeset git-tag`, which tags the version and reports the tag to the Changesets action, which pushes it and creates the GitHub release. A failed publish stops before tagging. There is no publish script, and the release path calls neither `npm` nor `pnpm` directly.

`vp run release:dry-run` builds and shows what `vp pm publish` would publish, without publishing or tagging.

Don't add `--provenance`: the repository is private, and an explicit provenance request fails the publish.

The release jobs install with `--ignore-scripts` and set `pnpm_config_verify_deps_before_run: "false"`, so no dependency script runs in a job holding `id-token: write`. They run no checks; CI already gates every PR and push. Nothing publishes unless `.github/workflows/actions.lock` verifies, and the release jobs use no cache.

## One-time owner setup

1. On npmjs.com, for `@thomasfosterau/effect-ical`: Settings → Trusted Publisher → GitHub Actions, repository `thomasfosterau/effect-ical`, workflow `release.yml`, environment `release`.
2. In the repository settings, Environments → `release`: add required reviewers.
3. Settings → Actions → General: allow GitHub Actions to create and approve pull requests.

A trusted publisher can only be attached to a package that exists. To publish a first version by hand, from a clean `trunk` as `thomasfosterau`: `vp install --frozen-lockfile`, `vp run release:dry-run`, then `vp run release`, then `git push origin --tags`.

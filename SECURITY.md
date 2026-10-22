# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately to Thomas Foster at me@thomasfoster.au, or through GitHub's **Report a vulnerability** button (Security → Advisories) if you have access to the repository, **not** through public issues.

You can expect an initial response within a few days. Please include a description, reproduction steps (an input calendar if relevant) and the affected version.

## Scope

The library parses untrusted text: input that makes the parser crash, hang, overflow the stack or use memory far beyond the input's size is in scope, as is output from the encoder that lets a value inject extra content lines (for example an unescaped newline in a TEXT property). The library does no I/O and reads no credentials.

## Supply-chain hardening

The package is published with a hardened, automated pipeline designed to resist supply-chain attacks (e.g. self-propagating npm worms that steal credentials and publish trojanized versions):

- **No long-lived npm token.** Releases use npm [OIDC Trusted Publishing](https://docs.npmjs.com/trusted-publishers): GitHub Actions proves its identity to npm with a short-lived, workflow-bound token. There is no `NPM_TOKEN` secret to steal from CI.
- **Install scripts disabled in the release job.** The release workflow installs with `pnpm install --frozen-lockfile --ignore-scripts` and turns off pnpm 11's `verify-deps-before-run` for that job, so a compromised (transitive) dependency cannot run install hooks in the privileged publish job. CI runs the repo's own `prepare` (the `@effect/tsgo` patch the type gate needs) but only ever holds read permissions.
- **Pinned actions.** Every GitHub Action is pinned to a full commit SHA, so a hijacked tag cannot inject workflow code.
- **Least privilege.** Workflows default to `permissions: {}`; each job opts into only the scopes it needs. CI checks out with `persist-credentials: false`.
- **Manual approval gate.** Publishing runs in a protected `release` environment.
- **Locked dependencies with a cooling-off period.** Installs use the committed `pnpm-lock.yaml` with `--frozen-lockfile`; `minimumReleaseAge` holds newly published third-party versions for a day before pnpm installs them; Dependabot proposes updates with the same cooldown. CI runs `pnpm audit --audit-level high`.
- **No runtime dependencies** besides the `effect` peer.

The pipeline and its one-time maintainer setup are in [PUBLISHING.md](PUBLISHING.md).

# Security

## Reporting a vulnerability

Report vulnerabilities privately to Thomas Foster at me@thomasfoster.au, or through GitHub's **Report a vulnerability** button, not through public issues. Include a description, reproduction steps (an input calendar if relevant) and the affected version.

## Scope

The library parses untrusted text: input that makes the parser crash, hang, overflow the stack or use memory far beyond the input's size is in scope, as is encoder output that lets a value inject extra content lines. The library does no I/O and reads no credentials.

## Supply chain

- Releases use npm trusted publishing; there is no long-lived npm token.
- The release jobs install with `--ignore-scripts`. Workflows default to `permissions: {}`, never persist checkout credentials, and pin actions by `.github/workflows/actions.lock`.
- `minimumReleaseAge` holds new third-party versions for 8 hours; Dependabot waits 1 day. CI runs `pnpm audit --audit-level high`.
- No runtime dependencies besides the peers.

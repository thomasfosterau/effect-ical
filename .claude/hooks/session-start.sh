#!/usr/bin/env bash
#
# Provision a checkout for NON-INTERACTIVE use — the Claude Code SessionStart
# hook (`.claude/settings.json`), so an agent session can run the gates
# (`vp check`, `vp run check`, `vp run test:unit`, `vp run test:coverage`,
# `vp run build`) without manual setup. The same shape as the sibling library
# repos' hook (copied from effect-ext's).
#
# ## What it does
#
# 1. Installs Vite+ (`vp`), the one tool this script guarantees; everything
#    else is reached through it. The global CLI is installed at exactly the
#    `vite-plus` version pinned in `pnpm-workspace.yaml`'s catalog, using the
#    official installer, which takes the release from the npm registry,
#    refuses a package without npm provenance and checks its SHA-512
#    `dist.integrity`. It installs under `$VP_HOME` (else `~/.local/share/vite-plus`) and
#    touches no shell profile, so `vp` and `vpx` are then linked into
#    `~/.local/bin`, a directory already on PATH in the session image and
#    writable by the session user: a symlink to the real binary survives where
#    an `export` from this script cannot.
# 2. `vp install --frozen-lockfile`. That is also what patches the native
#    TypeScript compiler and the `oxlint` that `vite-plus` carries with
#    @effect/tsgo, and installs the Vite+ git hooks (`vp config`) — the root
#    `prepare` script runs on every install — so after this hook `tsc` reports
#    `+effect-tsgo.<version>` and `vp run check` emits Effect's own diagnostics
#    exactly as CI does.
#
# From there the global `vp` delegates development commands to the
# project-local `vite-plus`, including inside `.claude/worktrees/*`, so each
# checkout runs its own pinned toolchain (and its own vitest, gardeneria
# #1663) without a shim. Project tools run through Vite+: `vp exec fallow …`
# for fallow (the PreToolUse fallow gate does the same), `vpx <file>.ts` for
# TypeScript scripts. Nothing else is put on PATH: no shim walks a directory
# tree, and nothing runs a `node_modules/.bin` the session did not install.
#
# Earlier versions of this hook wrote a `vp` shim that walked up from `$PWD`
# and a `fallow` re-exec shim (effect-wikimedia#219) into `~/.local/bin`, and
# before that symlinks into `node_modules`; those are removed or replaced when
# found (only ones this hook made: a symlink into a `node_modules`, or a file
# carrying its `# generated-by:` marker).
#
# If the installer cannot run (no network to vite.plus / viteplus.dev, or the
# catalog pin cannot be read), `vp` falls back to a one-line re-exec of this
# project's own `node_modules/vite-plus/bin/vp`, and the hook says so.
#
# Unconditional, not only when node_modules is absent: a prebaked container
# can carry a tree built from an OLDER lockfile, and stale dependencies
# masquerade as trunk breakage. A frozen install is a sub-second no-op when
# the tree is already in sync, and `effect-tsgo patch` skips a binary whose
# hash already matches its replacement.
#
# `vp install` uses the `packageManager` pin (pnpm 11). Without the global
# CLI, the install goes through Corepack whenever it is available (it honours
# the pin) and falls back to the `pnpm` on PATH; the session image may ship an
# older pnpm.
#
# ## Secrets
#
# This hook hydrates NO secrets. The library is pure (no network, no
# filesystem), so nothing here needs a credential.
#
# ## Contract
#
# Idempotent, and never fatal. Every failure path logs and continues, because
# the SessionStart hook must not block a session and a half-provisioned
# checkout is more useful than a session that refused to start. Callers that
# want hard failure should check the tools themselves afterwards.
#
# Untrusted-content note: the only value read from the repository is the
# `vite-plus` catalog version, and it is used only when it is a plain
# `MAJOR.MINOR.PATCH`. It takes no input from issue or PR bodies, or anything
# an agent could have been persuaded to write earlier in a session. Do not add
# other input without revisiting this note — it runs on every session start.

set -uo pipefail

log() { printf '[session-start] %s\n' "$1" >&2; }

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOCAL_BIN="${HOME:-/root}/.local/bin"
# The installer installs under `$VP_HOME` when it is set (the Vite+ dev
# container image sets VP_HOME=/home/vp/.vite-plus and ships the CLI there),
# else under `~/.local/share/vite-plus`. Look where it put it, or the pin check
# never matches and the hook reinstalls and falls back on every run.
VP_GLOBAL_BIN="${VP_HOME:-${HOME:-/root}/.local/share/vite-plus}/bin"
# Matches every marker this hook has written (the old `vp` and `fallow`
# re-exec shims included) and the fallback shim below.
SHIM_MARKER="# generated-by: .claude/hooks/session-start.sh"

mkdir -p "$LOCAL_BIN" 2>/dev/null || log "cannot create $LOCAL_BIN; continuing"

made_by_hook() {
  grep -qF "$SHIM_MARKER" "$1" 2>/dev/null
}

# Replace $dest with a symlink to $src unless $dest is a real file this hook
# did not make (something deliberately installed it).
link_to() {
  src="$1"
  dest="$2"
  if [ -e "$dest" ] && [ ! -L "$dest" ] && ! made_by_hook "$dest"; then
    return 0
  fi
  ln -sfn "$src" "$dest" 2>/dev/null || log "could not link $(basename "$dest")"
}

# Remove a PATH entry an earlier version of this hook created.
remove_old_link() {
  dest="$LOCAL_BIN/$1"
  if [ -L "$dest" ]; then
    case "$(readlink "$dest")" in
      */node_modules/*) rm -f "$dest" 2>/dev/null && log "removed old $1 link" ;;
    esac
  elif [ -f "$dest" ] && made_by_hook "$dest"; then
    rm -f "$dest" 2>/dev/null && log "removed old $1 shim"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  log "node not found; nothing to provision"
  exit 0
fi

# ── 1. Vite+ at the catalog pin ──────────────────────────────────────────────
VP_PIN="$(sed -nE 's/^  vite-plus: "?([0-9]+\.[0-9]+\.[0-9]+)"?$/\1/p' "$PROJECT_DIR/pnpm-workspace.yaml" 2>/dev/null | head -1)"
VP_HAVE="$("$VP_GLOBAL_BIN/vp" --version 2>/dev/null | sed -nE '1s/^vp v([0-9.]+).*$/\1/p')"
if [ -z "$VP_PIN" ]; then
  log "could not read the vite-plus catalog pin; not installing Vite+"
elif [ "$VP_HAVE" != "$VP_PIN" ]; then
  log "installing Vite+ $VP_PIN (have: ${VP_HAVE:-none})…"
  if command -v curl >/dev/null 2>&1 \
    && curl -fsSL https://vite.plus | VP_VERSION="$VP_PIN" bash >/dev/null 2>&1; then
    log "Vite+ $VP_PIN installed"
  else
    log "Vite+ installer failed (is vite.plus / viteplus.dev reachable?); continuing"
  fi
fi

remove_old_link fallow
remove_old_link tsx
if [ -x "$VP_GLOBAL_BIN/vp" ]; then
  link_to "$VP_GLOBAL_BIN/vp" "$LOCAL_BIN/vp"
  link_to "$VP_GLOBAL_BIN/vpx" "$LOCAL_BIN/vpx"
else
  # Fallback: the project's own pinned copy, by its fixed path.
  log "global Vite+ unavailable; \`vp\` runs $PROJECT_DIR's node_modules copy"
  for name in vp vpx; do
    dest="$LOCAL_BIN/$name"
    if [ -e "$dest" ] && [ ! -L "$dest" ] && ! made_by_hook "$dest"; then
      continue
    fi
    target="$PROJECT_DIR/node_modules/vite-plus/bin/$name"
    [ "$name" = vpx ] && target="$PROJECT_DIR/node_modules/.bin/vpx"
    printf '#!/usr/bin/env bash\n%s (%s fallback)\nexec "%s" "$@"\n' \
      "$SHIM_MARKER" "$name" "$target" >"$dest.tmp" \
      && chmod +x "$dest.tmp" && mv -f "$dest.tmp" "$dest" \
      || { rm -f "$dest.tmp" 2>/dev/null; log "could not write the $name fallback"; }
  done
fi

# ── 2. Dependencies ──────────────────────────────────────────────────────────
# The fallback `vp` points into node_modules, which may not exist yet, so only
# the global CLI installs; without it, pnpm (through Corepack when it can) does.
if [ -x "$VP_GLOBAL_BIN/vp" ]; then
  INSTALL=("$VP_GLOBAL_BIN/vp" install)
  INSTALL_DESC="vp install"
else
  INSTALL=(pnpm install)
  if command -v corepack >/dev/null 2>&1 \
    && (cd "$PROJECT_DIR" && corepack pnpm --version >/dev/null 2>&1); then
    INSTALL=(corepack pnpm install)
  elif ! (cd "$PROJECT_DIR" && pnpm --version >/dev/null 2>&1); then
    log "no usable pnpm found; run \`corepack enable\` or install pnpm 11, then \`pnpm install\`"
    exit 0
  fi
  INSTALL_DESC="${INSTALL[*]} ($(cd "$PROJECT_DIR" && "${INSTALL[@]:0:${#INSTALL[@]}-1}" --version 2>/dev/null))"
fi

if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
  log "syncing dependencies against the lockfile (${INSTALL_DESC})…"
  # CI=true: pnpm otherwise stops for a TTY confirmation before rebuilding a
  # modules directory that an older pnpm or different settings produced.
  if (cd "$PROJECT_DIR" && CI=true "${INSTALL[@]}" --frozen-lockfile >/dev/null 2>&1); then
    log "dependencies in sync; native tsc: $("$PROJECT_DIR/node_modules/.bin/tsc" --version 2>/dev/null || echo unavailable)"
  else
    log "dependency install failed; run \`vp install\` by hand and check the output"
  fi
fi

exit 0

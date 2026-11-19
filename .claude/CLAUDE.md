# Claude Code

Read README.md, docs/CONTRIBUTING.md and AGENTS.md (imported below). This file covers only Claude Code specifics.

- **Hooks** (`.claude/settings.json`): PreToolUse runs `vp exec fallow audit --base origin/trunk` from the project directory before any `git commit` / `git push` and blocks on a `fail` verdict. It reads the coverage map on disk, so run `vp run test:coverage` first. PostToolUse runs `vp fmt --write` on each edited file.
- **Worktrees** go under `.claude/worktrees/`, one per branch; run `vp install` in each.

@../README.md

@../docs/CONTRIBUTING.md

@../AGENTS.md

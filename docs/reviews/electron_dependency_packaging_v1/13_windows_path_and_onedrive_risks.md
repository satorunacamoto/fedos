# 13. Windows Path and OneDrive Risks

Addresses the REAL environment this repository is actually developed in,
not a generic/idealized one.

## Observed facts

- **The primary checkout lives under a OneDrive-synced path containing
  Japanese characters** (e.g. `C:\Users\<user>\OneDrive - <institution>\...\OS`).
  Every Arc/worktree in this stack's own development history has
  deliberately used a SHORT, non-OneDrive path instead (`C:\wt\<name>`) —
  this is not incidental; it is the same risk this document names,
  already being actively worked around by every prior Arc's own explicit
  worktree instruction.
- **MAX_PATH.** Windows' legacy 260-character path limit is a real risk
  once a long OneDrive+Japanese-segment prefix is combined with a deeply
  nested `node_modules` tree — Electron's own dependency tree (`04`) is
  large and deeply nested, materially increasing the chance of hitting
  this limit versus this repository's current, shallow 5-dependency tree.
- **Spaces.** The observed primary path contains spaces — build tools,
  shell scripts, and packaging manifests that fail to quote paths
  containing spaces are a real, recurring class of Windows packaging
  bug.
- **CRLF.** This repository's own Git configuration already warns "LF
  will be replaced by CRLF" on ordinary file writes on this Windows
  checkout — confirmed reproducibly on every commit made to any worktree
  in this stack's history. Packaging scripts (shell scripts, NSIS
  scripts, `.cmd` files) are line-ending-sensitive; this is a real,
  already-observed characteristic of this exact environment, not a
  hypothetical.
- **Antivirus/file locking.** OneDrive's own sync agent and Windows
  Defender can both lock files mid-write — a real risk for any
  `dist/`/`node_modules`-heavy build step landing inside a synced folder.
- **Stale worktree metadata.** This repository's own `git worktree`
  bookkeeping has repeatedly shown stale/orphaned admin entries that
  ordinary `git commit` operations attempt (and, due to concurrent access
  from other sessions/worktrees, sometimes fail) to prune — an
  already-observed, repository-specific characteristic of working with
  many parallel worktrees on this exact machine, independent of Electron.

## Recommendation

**Build OUTPUT (bundler output, `electron-builder`/packager output,
`node_modules` used for the build) must live OUTSIDE OneDrive sync scope
entirely** — a local, non-synced, short path (mirroring the EXACT
`C:\wt\...` convention this repository's own development process already
uses for every worktree, for exactly this reason). The SOURCE repository
itself may remain wherever it is; only build/package OUTPUT needs to be
relocated. This is not a new risk Electron introduces — it is the same
risk this repository's own existing worktree discipline already manages,
scaled up by Electron's own larger dependency/build footprint (`04`).

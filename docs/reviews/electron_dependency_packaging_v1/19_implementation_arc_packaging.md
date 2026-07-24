# 19. Implementation Arc Packaging

Per this review's own instruction: avoid one giant, uncontrolled
implementation Arc given the real, confirmed tooling/dependency
uncertainty this review found (`04`: no bundler, no CI, step-change
dependency size; `13`: real Windows/OneDrive path risk).

## Package A: Electron dependency/build foundation

Add `electron` + a packager (devDependencies only). Get a BLANK window
opening via `electron .` in local development. No Host wiring, no IPC, no
real feature. Purpose: retire the single biggest unknown this review
found — whether Electron's own install/build/launch works cleanly in
THIS repository's actual environment (`04`/`13`) — before any further
design work depends on the answer.

## Package B: main/preload adapter

Implement a `FedosDesktopHostPort`-conformant main-process wiring (reusing
`FedosDesktopHostBridge` as-is, or a thin sibling) plus the allowlisted
preload bridge (`05`/`06`), tested with real IPC round-trips. Still no
visual renderer page beyond a functional stub sufficient to prove the
wiring.

## Package C: minimal renderer page

The actual UI — the first real consumer of `FedosDesktopRenderer`'s own
render models. Deliberately NOT designed or scoped further by this
review — a UI-design decision outside this review's own scope, and
DEPENDENT on a separate, still-open decision (`10`'s own unlock-boundary
gap) if it is to expose Archive/production-crypto features
interactively.

## Package D: packaging/smoke tests

`electron-builder` (or equivalent) portable build (`12`) + a real
launch-and-quit smoke test (`18`). Still no auto-update, no installer, no
code signing.

## Why not one Arc

Bundling A–D into a single Arc would mean committing to main/preload/
renderer design decisions (B/C) BEFORE knowing whether Electron even
builds/launches cleanly in this exact environment (A) — exactly the
"high tooling uncertainty" case this review's own instruction names as
the reason to split. A single failed or awkward Package A would be cheap
to discard or redo; a single failed Arc combining all four would not be.

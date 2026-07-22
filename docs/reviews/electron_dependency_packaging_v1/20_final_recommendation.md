# 20. Final Recommendation

## Chosen option: D. Electron dependency/build spike first

Not A (full Electron adoption), not B (Tauri), not C (framework-neutral
Host remains sufficient forever), not E (blocked pending secure unlock
boundary), not F (an unspecified "another option").

## Reasoning

- **A (Electron now, in full)** is rejected as stated because the tooling
  uncertainty this review found (`04`: no bundler, no CI, a step-change
  dependency addition; `13`: real Windows/OneDrive path risk) is too high
  to commit to a full main/preload/renderer implementation Arc in one
  step.
- **B (Tauri now)** is rejected: Tauri requires a substantially larger,
  more novel change to this repository's own strictly-guarded Rust crate
  (a new GUI-hosting binary target/native-windowing dependency against a
  crate whose own tests assert its production-dependency COUNT
  line-by-line, `03`) than Electron requires on the TypeScript side — a
  bigger, less-reversible first step than option D, for a smaller
  runtime-size benefit this review found no evidenced requirement for
  (`02`).
- **C (framework-neutral Host remains sufficient)** is rejected because
  it is not a path to ever shipping a real, usable product (`02`) — the
  Host Boundary Foundation Arc's own work is complete and valuable, but a
  local desktop tool with no window is not yet a tool anyone but a
  developer can use.
- **E (blocked pending secure unlock boundary)** is rejected as the
  FRAMING for this specific decision: the unlock-boundary gap (`10`) is
  real and unresolved, but it does not block Package A (`19`) — a blank
  Electron window opening in local development requires no passphrase
  entry at all. The unlock gap DOES block Package C (a feature-complete
  renderer page) and must be solved before that package is attempted,
  but that is a scoping note within the chosen plan, not a reason to
  block starting it.
- **F (another clearly justified option)** is rejected: this review
  independently compared a custom native WebView host and a PWA/browser
  shell (`03`'s own options C/D) and found neither justified — a custom
  WebView host has no accepted, mature dependency to build on, and a PWA
  directly conflicts with this repository's own standing "no remote web
  hosting" prohibition. No other, unnamed option was identified with
  stronger justification than D.

## What is NOT decided by this recommendation

- No packaging tool (`12`), no code-signing certificate (`14`), no
  update mechanism (`15`), and no renderer-page UI design (`19`'s own
  Package C) are chosen — all remain explicitly deferred, each pending
  its own evidence.
- The Master Seed unlock boundary (`10`) remains an open, separate
  blocker that a LATER package (C) must resolve — it is not solved,
  worked around, or newly designed by this review.

## Recommended next Arc

**Electron Dependency and Build Spike Arc** — implements ONLY this
review's own `19`, Package A: add `electron` + a packager as
devDependencies, produce a blank window launching via local development
tooling, and document the real, observed build/tooling experience
(confirming or correcting this review's own `04`/`13` predictions) —
no Host wiring, no IPC, no renderer feature, no production Runtime
dependency added or touched.

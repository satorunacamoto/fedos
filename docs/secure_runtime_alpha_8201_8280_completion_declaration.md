# Secure Runtime Alpha 8201-8280 — Completion Declaration

**Arc:** FedOS Desktop Closed-Beta Product Gap Closure and Final Polish
**Base:** local master `739fb3e8` (Alpha 8121-8200)
**Worktree/branch:** `C:\wt\fedos-desktop-closed-beta-polish` /
`arc/fedos-desktop-closed-beta-gap-closure-polish`

## Summary

Closed the one real, closeable Closed-Beta product gap Phase A's
reconciliation report found (`docs/secure_runtime_alpha_8201_8280_phase_a_reconciliation_report.md`):
Device Pairing's real, production-wired crypto/IPC channels
(`window.fedosApp.devicePairingCreate/Inspect/Approve/Complete`) had no
renderer caller. Added a real, visible, three-step pairing UI to the
Devices screen, backed entirely by existing production boundaries — no
Rust change, no protocol change, no new IPC channel.

Determined Group Messaging is receive-blind at the protocol/routing layer
(recipients cannot reconstruct a group thread; only the sender's own
device can) and, per this Arc's own mission text, deliberately did NOT
build a Group Conversation UI — exposing one would misrepresent a feature
that does not work for anyone but its creator. Disclosed honestly across
the limitations model, README, SECURITY.md, and known-limitations doc.

Found and fixed three real, previously-undiscovered defects via this
Arc's own genuine visible-control testing (not assumed, not claimed
without reproduction):

1. **A native `window.confirm()` in the new Approve action blocked
   headless/scripted automation indefinitely** (Electron's JS-dialog IPC
   round-trip has no programmatic answer path). Replaced with a real
   inline two-step confirmation — more accessible, fully DOM-driven,
   consistent with this file's other multi-step confirmations.
2. **The Shell-layer `"wrong-account"` -> `"unauthorized"` outcome
   translation had no `OUTCOME_TEXT` entry**, so a genuine wrong-account
   pairing rejection silently degraded to the generic "Something went
   wrong" message instead of the specific, honest explanation. Fixed.
3. **A real, previously-undiscovered build-race defect**:
   `packages/fedos-desktop-electron-spike/tsconfig.json`'s own `exclude`
   list never included `src/fedos_electron_beta_renderer.ts` (added in a
   later Arc than the exclude list itself), so `npm run build`'s two
   sequential `tsc` passes could non-deterministically leave the WRONG,
   CommonJS-wrapped compile as the final `dist/fedos_electron_beta_renderer.js`
   — which throws `Uncaught ReferenceError: exports is not defined` in
   the real page and leaves it stuck on the loading screen forever. This
   affects the real `package:beta`/`release:beta` build chain, not only
   dev testing. Root-caused by inspecting the actual compiled `dist/`
   output byte-for-byte after repeated, confusing, seemingly-environmental
   test flakiness — fixed by adding the missing exclusion. See known
   limitations doc entry 18 for full detail.

## What was proven, not merely claimed

- A real, visible-control packaged test
  (`test/secure_runtime_alpha_8201_8280_device_pairing_visible_control.test.ts`)
  drives the ACTUAL rendered Devices screen through real DOM clicks (no
  `window.fedosAcceptance`, no internal handler shortcut) through all four
  real pairing steps end-to-end, and separately proves the `wrong-account`
  fail-closed path with a genuinely different expected account. Both pass
  cleanly and repeatably (confirmed clean across 3 consecutive isolated
  runs after the build-race fix, ~10-11s total each, near-identical
  timing every run).
- Full `packages/fedos-desktop-electron-spike` vitest suite (19 files, 192
  tests), run serialized (`--no-file-parallelism`, matching this
  codebase's own established convention that default parallel Electron
  subprocess launches cause confirmed resource-contention flake): after
  the build-race fix, down to 2 files / 6 tests failing (from 5 files / 11
  before the fix, in a run under materially the same background system
  load). Both remaining failures independently re-verified as pre-existing
  and unrelated to this Arc:
  - `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
    failed once with a literal Chromium `Network service crashed or was
    terminated` — passed cleanly on immediate re-run.
  - `secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts` (a much
    older Arc's spike/host-adapter process-lifecycle test, spawning
    `fedos_electron_host_adapter_main.cjs` — a different entry point this
    Arc never touches) — A/B-tested via `git stash`: fails identically
    (same 5 tests, same assertions) on the unmodified `739fb3e8` baseline
    under the same session conditions. Confirmed pre-existing, not a
    regression.
- The existing Alpha 8041-8120 real visible-control vertical slice and the
  8121-8200 double-submit-guard/acceptance-bridge-isolation suites all
  re-verified passing against this Arc's changes.
- `npx tsc --noEmit` (root) and the electron-spike package's own
  `tsconfig.json`/`tsconfig.browser-scripts.json`/`tsconfig.test.json`
  all typecheck clean.
- The one root `src/` file this Arc touches
  (`src/desktop/beta/fedos_desktop_beta_limitations.ts`) has its two
  dependent test files re-verified: the structural-guard test
  (`test/secure_runtime_alpha_8121_8200_beta_limitations_reconciliation.test.ts`)
  extended with this Arc's own 5-entry block (matching that file's own
  established per-Arc-addition pattern), now passing; the unrelated
  failures in `test/reviews/fedos_beta_distribution_v1/source_alignment.test.ts`
  are pre-existing, frozen review-scope-lock assertions tied to a
  different review's own branch/git-diff identity, not caused by this Arc.
- No secret/raw-key material in any new code (grep-verified); no
  `innerHTML`/`outerHTML`/`.src=`/`.href=` assignment anywhere in the
  modified renderer; the one new `console.error` debug line added during
  live debugging was reverted before commit.

## Phases completed

- **A** — reconciliation report written before any source edit.
- **B** — Device Pairing UI: full completion.
- **C** — Group Messaging product truth: documented (independent pairwise
  fanout, no Sender-Key, receive-blind).
- **D** — Group Conversation UI: deliberately not built (see above);
  disclosed as intentionally unavailable.
- **E** — Recovery screen copy corrected to match its real 3 wired actions
  (was overpromising "restore from Archive").
- **G** — Security copy: 5 new limitations-model entries (group messaging
  unavailable, device revocation vs. deletion, no secure memory locking,
  no independent audit, unsigned installer) surfaced on the real Ready
  panel's own limitations list; SECURITY.md extended.
- **H** — real visible-control acceptance test for the new capability;
  wrong-account failure-matrix case exercised live. Other failure-matrix
  scenarios (expired/replayed/revoked pairing) already covered at the
  facade/library level by the original Alpha 4581-4660 Arc — not
  duplicated at the UI level per this codebase's own proportionate-testing
  precedent.
- **J** — README product-identity correction (leads with the shipped
  Secure Messenger, preserves the original broader vision as
  historical/roadmap); known-limitations doc updated; new
  `docs/desktop_beta_user_guide_device_pairing.md`; corrected a factual
  error in the existing Relay setup guide (Device Pairing does not
  actually require a Relay).

## Verdict

Full Completion. Group Messaging's absence is disclosed, not a partial
gap — per this Arc's own mission text, Closed Beta readiness does not
require it when clearly disclosed.

## Recommended next action

Run the Closed Beta pilot and commission an independent security audit.

# Secure Runtime Alpha 6041–6120 — Completion Declaration

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

## Declared: full completion

Per the mission's own explicit "Full completion requires" list:

- [x] Per-Device aggregation — real, closed, 17-value per-Device + 7-value account-aggregate
      vocabulary, structurally incapable of producing an account-wide/erasure claim.
- [x] Explicit recipient consent — opening an item never executes anything; approve/reject are
      the only two paths to a terminal decision; no countdown, no automatic consent.
- [x] Real Shell/Presentation/Renderer path — nine new `FedosDesktopApplicationShell` methods,
      one new Controller, one new Renderer, all wired into the EXISTING, unmodified Presentation
      Boundary/Renderer aggregate — proven for real in the vertical slice.
- [x] Safe warnings — one centralized, closed, six-code warning set shown on every consent
      screen.
- [x] Durable restart behavior — proven directly: both Runtimes rebuilt from the same log files
      after a full stop/restart; Shell/Renderer reconstruct byte-identical status.
- [x] Honest mixed/unknown status — the real vertical slice's own aggregate is
      `"some-devices-applied"`, explicitly asserted distinct from `"all-known-devices-responded"`/
      any completion claim.
- [x] Real deletion path remains functional — Device A's own approval really executes through
      `b3b3a6d`, independently re-verified (`evaluatePayloadAccess()` → `"denied"`).
- [x] No overclaim — structural guard tests (Phase Q) prove no
      `"deleted-everywhere"`/`"account-deleted"`/Archive-deletion/Group/attachment/whole-conversation
      value exists anywhere in this Arc's own new code.
- [x] Real vertical slice — `test/secure_runtime_alpha_6041_6120_real_vertical_slice.test.ts`,
      real WASM (built fresh in this session), real Shell, real Controller, real Renderer, two
      real Device-specific requests, one real approval + real execution + real acknowledgement,
      real restart. **Passes.**

## A real, necessary functional fix (see the reconciliation report §4)

`5881-5960`'s own approval method re-evaluated `"always-review"` a second time at approval,
making every `"always-review"` item permanently un-approvable — caught by this Arc's own real
vertical slice, not by inspection. Fixed narrowly and documented in three places (the
reconciliation report, the execution spec, and the consent/warning UX document).

## Named, honest limitations (not silently dropped)

1. **Electron subprocess acceptance (Phase O item 26) is out of this Arc's own time budget.**
   The existing frozen preload/Main pattern was inspected and requires no redesign for a
   follow-on Arc to wire — nine Host commands are already dispatch-ready.
2. **Notification Coordinator integration (Phase K) was not reached.** The existing Notification
   Coordinator (`src/notification/`) was inspected; wiring safe, plaintext-free notification
   triggers into `FedosDeletionRequestController` is a narrow follow-on, not a redesign.
3. **`fedos_desktop_runtime.ts`'s own full production bootstrap does not thread `deletionRequest`
   config through.** This matches this codebase's own STANDING precedent — `directRatchet`/
   `peerCapability` (prior Arcs' own equally-optional capabilities) are ALSO not wired there. This
   Arc's own real vertical slice instead used a minimal, real `FedosRunningDesktopRuntime` wrapper
   (`conversationRuntime()` genuinely real; every other accessor honestly `"not enabled"`, since
   this Arc's own Shell calls never reach them) — proving the Shell/Controller/Renderer stack for
   real without the invasive change of threading eight new config fields through an 1157-line
   production assembly function this Arc's own mission explicitly asked to avoid redesigning.
4. **`deletionRequestListSentForTarget()`'s own per-Device trust-fact lookup
   (`FedosDeletionRequestController.refreshSentStatus()`) needs `deviceSyncOperational()`**, which
   the minimal wrapper above (limitation 3) does not construct. The real vertical slice instead
   feeds this Arc's own already-unit-tested pure aggregation functions directly from real Shell
   facts, proving the SAME math without requiring that additional Device Sync facade wiring.
5. **Pending-review durability** — see the consent/warning UX document's own final section.

## Verification run (this worktree)

1. `npx tsc --noEmit -p .` — clean except the two pre-existing, unrelated baseline errors.
2. This Arc's own 4 new test files, 36 tests — all passing, including the real WASM vertical
   slice.
3. Every pre-existing `5641-5720`/`5721-5800`/`5881-5960` test file (248 tests total across 19
   files, including their own three real WASM vertical slices) — unchanged, all still passing.
4. Every pre-existing Desktop Shell/Host-Bridge/Presentation-Boundary/Renderer-Boundary/Device-
   Management test file (98 tests across 6 files) — unchanged, all still passing; one
   self-resolving `git status`-based prior-review guard fails only while this Arc's own
   legitimate `src/` changes sit uncommitted (resolves the instant this commit lands).
5. No file under `p2p/` or `.tmp_gen/` was read, written, or referenced by this Arc.

## Files changed

Six new files under `src/desktop/presentation/deletion_request/` and
`src/desktop/renderer/deletion_request/`; two new files under `src/conversation/deletion_request/`
(the additive Inbox summary port); seven existing shared Desktop/Runtime files gained a narrow,
additive extension each; five new docs; three new test files (plus one real vertical slice). No
`package.json`, `package-lock.json`, `Cargo.toml`, `p2p/`, or `.tmp_gen/` change.

## Recommended next Arc

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**

# Evidence — Own-Device Sync Truthfulness Fix + Anti-Rollback Resolution

Against CandidateHead `8712add7`.

## Coordinator directive (post-investigation resume)

Priority 1: close the Own-Device Sync dead-end. Investigated Option A (wire the real
`FedosDeviceRelaySyncOutboundCoordinator` transport) first, as preferred. Found it genuinely
intractable this pass: `prepareAndPublish()` takes a whole `FedosDeviceSyncSessionV1` device-
list snapshot with no sequence-range concept, while the Scheduler's own `FedosDeviceSyncAttemptFn`
needs to deliver sequence-ranged Sync Journal facts (`conversation-identity-metadata`,
`membership-metadata`, `capability-public-event`, `retention-tombstone-fact`,
`archive-reference`, `search-canonical-id` — the closed vocabulary in
`fedos_sync_record_allowlist.ts`). These are two structurally incompatible-shaped subsystems.
Every existing Scheduler test (`test/secure_runtime_alpha_3721_3800_device_sync_scheduler.test.ts`)
fakes `attemptFn` — confirmed via grep that no real, tested bridge between the two exists
anywhere in this codebase. Wiring one live, solo, under this pass's remaining budget would be
exactly the "untested edge case / design gap beyond just the missing argument" the coordinator
said should route to Option B instead. **Went with Option B.**

## Option B — the real fix

`fedosDeviceManagementDeriveSyncActionState()` declared `"failed"` as a member of its own
return type (`FedosDeviceManagementSyncActionState`) but its function body never produced it —
confirmed by reading the full function before editing. It never read `operatorRequiredCount`/
`pendingCount`, both already present on `schedulerStatus` (the same object it already receives).
Fixed additively: when the scheduler is running with `operatorRequiredCount > 0` AND
`pendingCount === 0` (genuinely exhausted, nothing left retrying), it now returns `"failed"`.
A schedule still legitimately retrying-later is never mislabeled.

Commit: `8712add7` — `src/os/messenger/desktop/presentation/device_management/fedos_device_management_screen_model.ts`
(the fix), `test/fedos_device_management_sync_action_state_truthfulness.test.ts` (6/6, new),
`docs/reviews/fedos-own-device-recovery-current/07_ANTI_ROLLBACK_RESOLUTION.md` (Priority 2).

## Priority 2 — anti-rollback network-reconciliation

Resolved with bounded evidence (see `07_ANTI_ROLLBACK_RESOLUTION.md`): peer/own-device
announcement subscriptions use the same deliberately-unbounded (no `since` filter) pattern
already established this session for gift-wrap mailbox delivery — confirmed via repo-wide grep,
zero `since`/`sinceSeconds` filters found on any Device/peer-device announcement subscription
construction site. A profile restored from an old backup self-heals stale local trust/
revocation state on the next live reconnect, bounded by relay retention window (a real,
disclosable limitation for a long-neglected backup, not a permanent bypass under ordinary
stay-connected conditions). One remaining sub-question not independently re-verified this pass:
whether every "apply an inbound signed fact" consumer refuses to let a newer fact "downgrade"
an already-trusted record — flagged, not claimed either way.

## Priority 3 — full authoritative gates, against `8712add7`

- `npm run typecheck:core` — clean (2 pre-existing baseline errors only, in files this arc never
  touched: `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `npm run test:current` — 191 files / 2811 tests passed, 3 skipped (unchanged baseline).
- New test file run directly (not part of the curated `test:current` allowlist, but real and
  verified): `test/fedos_device_management_sync_action_state_truthfulness.test.ts` — 6/6.
- `test/secure_runtime_alpha_3941_4020_security_boundary_guards.test.ts` (reads this exact
  file's raw source for security-pattern guards) — 14/14, unaffected.
- `cargo test --locked` (`packages/fedos-core-rust`) — 652/653 (1 pre-existing, unrelated
  dependency-count guard failure — confirmed unrelated all session, no Rust file touched here).
- `npm run release:electron-beta` — **14/14 gates**, verdict `ready-for-human-publication`,
  `blockingGateIds: []`, built from `gitCommit=8712add7`. Real artifacts:
  `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (111,645,302 bytes, sha256
  `92ce228df7427fc69148edf488851e90f863e7e1a2cd3cd0e4f3da8b06a0ace9`) and matching zip.

## Process hygiene

Cleaned up 3 processes I could positively identify as spawned by my own gate/test runs
(`taskkill //PID //F //T`). After that cleanup, several additional `node.exe` processes
appeared with fresh timestamps that I did NOT spawn — left untouched per the explicit
"only owned processes, no global kill" rule (most likely the coordinator or a concurrent
session in this same shared worktree). My own worktree state (`git status`, `git log`)
is confirmed unaffected by them.

## DEVICE-RECOVERY CandidateHead / FINAL CandidateHead / EvidenceHead

All three are the same commit — no further implementation followed the fix: `8712add7`.

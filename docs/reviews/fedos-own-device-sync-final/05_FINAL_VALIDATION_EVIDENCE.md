# Own-Device Sync Protocol Final Closure — Final Validation Evidence

StartingCandidateHead: `6aa2177d3`
CandidateHead (this arc's implementation): `03ca2fd4`
EvidenceHead (this commit)

## 1. FedosSyncState cross-process question — resolved with a real test

`test/fedos_own_device_sync_cross_process_repro.test.ts` (4/4 passing) proves, using two
separate `FedosSyncState` instances:

- `recordLocalChange()` alone on the receiving side is **broken**: it journals the entry but
  never stages it into the receiver's own pending queue, so `applyPendingChanges()` returns `[]`.
- **`recordLocalChange()` then `redeliverChange()`** is the correct composition: journal locally,
  then explicitly stage into the receiver's own pending queue. Cursor advances correctly, applies
  exactly once.
- Duplicate delivery is safe: caught independently at the journal level (`"duplicate"` append) and
  the pending-queue level (`"duplicate"` redeliver). No double-apply, cursor unchanged.
- Real finding: a receiver's own journal assigns sequence numbers by local arrival order, not the
  sender's original order — out-of-order delivery of same-conversation entries can silently apply
  in the wrong relative order with no conflict flagged. Not a `FedosSyncState` defect; mitigated at
  the transport layer (batch validated gapless-ascending, applied in strict array order).

## 2. Transport built

New directory `src/os/messenger/device/sync_journal_transport/` (9 files), mirroring the existing,
already-tested Device Registry relay-sync transport's wire-format/crypto/publish/inbound-verification
chain. No existing frozen class was modified. `createFedosDeviceSyncJournalAttemptFn()` gives
`fedos_electron_beta_main.cts`'s `wrapAttemptFn()` a real, non-stub `FedosDeviceSyncAttemptFn` — not
yet wired into the live Electron main process.

## 3. Test coverage

16 new tests (4 cross-process repro + 12 transport, `test/fedos_own_device_sync_journal_transport.test.ts`),
covering the applicable subset of the mandate's test matrix: duplicate delivery, out-of-order/reorder,
wrong account, wrong recipient/device, source-not-trusted, gap detection (a genuine hole from an
interleaved third device), offline (relay-reject -> `relay-disconnected`, relay-timeout ->
`relay-timeout`), restart-mid-batch (durable-state resume after a simulated crash partway through
applying a batch, via a fresh retry with a new transferSessionId), malformed-event rejection. Both
files added to `vitest.current.config.ts`'s fixed regression list.

Not covered at this transport layer (pre-existing, unmodified machinery already covers these
independently): Scheduler-level restart/single-flight recovery (`#recoverInterruptedSchedules()`),
Import Coordinator's richer conflict reclassification, wrong-profile (not a concept distinct from
wrong-account in this codebase's current identity model).

## 4. Full gates

- `npm run typecheck:core`: clean — 2 pre-existing, unrelated baseline errors only
  (`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`), neither touched by this arc.
- `npm run test:current`: **193 files / 2827 tests passing**, 3 pre-existing skips, 0 failures.
- `cargo test --release` (`packages/fedos-core-rust`): **652 passed / 1 known pre-existing failure**
  (`secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
  — a dependency-count guard test; this arc made no Cargo.toml or Rust changes at all).
- OSS gate: no dedicated npm/OSS-catalog script exists in this repo; N/A — this arc added no new
  dependencies and touched no license surface.
- `npm run release:electron-beta`: **succeeded, exit code 0**, against the clean, committed tree at
  `03ca2fd4`. Public Beta gate report verdict: `"ready-for-human-publication"`, 0 blocking gate ids.
  gitCommit recorded in the release manifest: `03ca2fd461c93cff4a06a87f2c04281312997f9d`.
  Artifacts: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (NSIS installer, 111,645,320 bytes),
  `FedOS Desktop Beta-0.1.0-beta.1-win.zip` (406,404,771 bytes), release manifest + SHA256SUMS,
  secret-scan clean (1,685 staging files, 0 findings).

## 5. Not attempted this pass

Item 3 from the coordinator's own follow-up (installed two-device proof: bootstrap, bidirectional
sync, offline, restart, one benign conflict, one security-sensitive conflict, wrong-account
negative) was not attempted — items 1, 2, and 4 consumed the available scope, and the coordinator
explicitly accepted stopping after 1-2 as honest. Wiring `createFedosDeviceSyncJournalAttemptFn()`
into `fedos_electron_beta_main.cts`'s live `wrapAttemptFn()` call was also not attempted — the
transport is proven correct in isolation but is not yet load-bearing in the packaged app.

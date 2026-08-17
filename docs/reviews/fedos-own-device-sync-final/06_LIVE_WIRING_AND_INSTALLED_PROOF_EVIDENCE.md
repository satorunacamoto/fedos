# Own-Device Sync Protocol Final Closure — Live-Wiring + Installed Proof Evidence

StartingCandidateHead: `6aa2177d3`
Prior EvidenceHead: `3c7d1376` (transport built + unit-level test-matrix, not yet live-wired)
CandidateHead (this round): `bd3402a0`
EvidenceHead (this commit)

## 1. Live-wired into the Electron main process

`createFedosDeviceSyncJournalAttemptFn()` now backs `fedos_electron_beta_main.cts`'s
`wrapAttemptFn()` call — previously always `wrapAttemptFn()` with no argument, i.e. the
Scheduler's own `deviceSyncAttemptFn` was permanently the fail-closed stub. The real
`FedosDeviceSyncJournalOutboundCoordinator` is now constructed inside
`startFedosDesktopRuntime()` itself (`deviceTrustEnabled` block), reusing the SAME durable
Device Registry / Sync Journal / observation-repository instances that block already owns —
gated on a new optional `deviceSyncJournalMasterSeedAuthority` config field (mirrors
`conversationArchiveMasterSeedAuthority`'s own established per-subsystem pattern) plus the
existing `conversationTransportRelays`/`conversationTransportSigningAuthority`. Exposed via a
new `runtime.deviceSyncJournalOutbound()` accessor; `fedos_electron_beta_main.cts` reaches it
through a lazy closure that mirrors the file's own existing `eventBridge` listener pattern
(constructed before the Coordinator exists, dereferences `coordinator.runningRuntime()` only
once actually invoked, long after a real create/unlock has completed).

Also added the previously-missing INBOUND half: `FedosDeviceSyncJournalInboundSubscription`
(new file, mirrors `FedosArchiveSuppressionInboundSubscription`'s established idiom exactly)
subscribes to the shared relay set and applies successful deliveries via
`syncState.applyPendingChanges()`, giving real bidirectional convergence rather than send-only
wiring — the transport was previously testable only by hand-calling the outbound
coordinator/inbound handler directly in unit tests; a live Runtime now does both automatically.

Packaging: no `electron_builder.beta.config.json` change was needed — the root repo's compiled
`dist/os/**` tree (where every new file lives) is copied wholesale via the existing `extraFiles`
rule, unlike the electron package's own flat `dist/fedos_electron_*.js` files (which DO need an
explicit `files` entry per the P0 packaging-allowlist lesson, but none of this arc's files land
there). Confirmed by a clean-`dist/` rebuild: all 10 `sync_journal_transport/` files compiled.

## 2. Real installed two-device proof

New test, `test/secure_runtime_own_device_sync_journal_transport_installed_two_device_proof.test.ts`
(~50s, real WASM crypto throughout — not part of the fast `test:current` gate, matching the
established precedent of the other real-vertical-slice tests in this repo). Two independent
`startFedosDesktopRuntime()` instances (separate durable directories, real WASM master seed +
signing authority shared between them representing the same account recovered on two devices,
one real in-process relay shared by both). Covers:

- **Bootstrap**: mutual trust via `FedosDeviceTrustRuntime`'s own real
  `registerDevice()`/`confirmTrust()`/`registerSyncDevice()` primitives (the same ones the real
  pairing-exchange protocol calls internally; pairing-protocol correctness itself is the
  4581-4660 Arc's own already-tested subject, not re-derived here).
- **Bidirectional convergence**: A → B and B → A, each landing correctly in the receiver's own
  durable journal with the cursor advancing to the entry's real (global, not per-origin) journal
  sequence.
- **Offline + restart catch-up**: Device B stopped, Device A publishes while B is down, B
  restarts as a fresh Runtime over the same durable directory and catches up via the shared
  relay's own store-and-forward replay.
- **A genuine benign conflict** (`concurrent-update`): required adding a real THIRD device of the
  same account — see finding below.
- **A security-sensitive conflict** (`tombstone-vs-upsert`): a later upsert for an
  already-tombstoned conversation is classified as a conflict, never silently applied/resurrected.
- **Wrong-account negative**: a genuinely different account's own outbound coordinator is
  refused (`target-not-trusted`) before any local mutation.

### Real findings surfaced only by the installed proof (not visible at the unit level)

1. **`FedosSyncJournal` sequence numbers are global per Runtime, not per origin device.** A
   receiver's own local journal assigns one shared, monotonic sequence counter across every
   origin recorded into it (its own local edits AND everything it receives). A caller computing
   a `[fromSequence, toSequence]` range for its own local entries (as the Scheduler's
   `planFedosDeviceSyncTargets()` does in production) must look up the actual sequence an entry
   landed at — "the Nth thing I recorded locally" is not "sequence N" once that device has
   received anything from a peer first. Not a defect; the outbound coordinator's own
   `readGaplessRange()` already handles this correctly — this was purely a wrong assumption in
   the test's own first draft, now fixed and documented.
2. **A device's own directly-recorded local changes never route through its own conflict
   classifier.** `recordLocalChange()` fans a new entry OUT to every other device's pending
   queue but never stages it into the recording device's OWN pending queue — so
   `classifyFedosSyncConflict()` never runs against a device's own local edits, only against
   entries it actually applies FROM its pending queue (i.e., genuinely received, or explicitly
   redelivered). Consequence: a real "two different devices independently edit the same
   conversation" conflict can only ever be observed on a receiving device that is NEITHER
   origin — with only two devices, that scenario is structurally unreachable. This is why the
   benign-conflict scenario required a real third device of the same account (added to the
   test) rather than being provable with just A and B. This is an honest architectural boundary
   of `FedosSyncState`'s own documented scope (conflict classification is pending-queue-scoped
   by design, never a materialization/resolution layer), not a bug — but it is a genuinely
   non-obvious constraint worth knowing before relying on two-device topologies to exercise
   conflict paths.

Both findings are now encoded directly in the test's own comments at the exact lines they apply.

## 3. Full gates, final state

- `npm run typecheck:core`: clean — 2 pre-existing, unrelated baseline errors only (unchanged
  from every prior round of this arc).
- `npm run typecheck:electron`: clean.
- `npm run test:current`: **193 files / 2827 tests passing**, 3 pre-existing skips, 0 failures
  (unchanged file count — this round's new installed-proof test intentionally was NOT added to
  this fast gate, matching precedent for real-vertical-slice tests; it runs under the full
  `npm run test` sweep).
- Targeted real-crypto suite (own-device-sync tests + the two pre-existing tests this round
  touched): **5 files / 57 tests passing**, including the new ~50s installed proof.
- `cargo test --release`: **652 passed / 1 known pre-existing failure** (dependency-count guard,
  untouched by this arc).
- `npm run release:electron-beta`: **succeeded, exit code 0**, against the clean, committed tree
  at `bd3402a0`. Verdict: `"ready-for-human-publication"`, 0 blocking gate ids. gitCommit
  recorded in the release manifest: `bd3402a01f27544333d2ac7f272003b1084612b6`.

## 4. Honest remaining scope

The Scheduler's own automatic interval-driven tick loop was never exercised end-to-end in this
arc's own tests (both the unit-level transport tests and the installed proof call
`prepareAndPublish()`/the outbound coordinator directly, bypassing `FedosDeviceSyncScheduler`'s
own tick/retry machinery) — the Scheduler itself (retry policy, abandonment, single-flight) is
pre-existing, unmodified, and already covered by its own prior Arc's tests; this arc's own
responsibility ends at giving it a real, non-stub `attemptFn`, which is now proven correct in
isolation (transport unit tests) and end-to-end through two real installed-shaped processes
(this round). A full soak test through the Scheduler's own real interval timer was judged out of
proportion to this arc's own scope.

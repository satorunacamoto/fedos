# Direct Ratchet Live-State Durability — Architecture Decision

**Status**: Frozen. Coordinator synthesis of Agents S/M/U/R's independent Phase A investigations
(`01`-`06` in this directory). Written against commit `3b78add15642fd38af601647c7ca332b1027e658`.

## Headline finding

This is **not** a "design new crypto persistence" task. Durable, file-backed, already-correct
implementations for both allegedly-missing ports already exist in this codebase
(`FileFedosDirectRatchetLiveStateSnapshotPersistence`, `FileFedosDirectRatchetRemotePublicKeyPersistence`),
already proven end-to-end by a real restart-simulating test
(`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts:335-603`) — they are simply
never constructed/wired in the desktop composition root (`fedos_desktop_runtime.ts`'s
`directRatchetEnabled` auto-construction never sets `snapshotPersistence`/
`remotePublicKeyPersistence`, unlike every sibling field). The disclosure comment in
`fedos_desktop_runtime_config.ts` claiming "no append-only backend exists anywhere" is stale.

The sealing mechanism itself (Rust `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`,
domain-separated via `HkdfDomain::DirectRatchetSealing`/`AeadAadDomain::DirectRatchetSealing`)
is shared, real, and already used for both the wired (`skipped-message-key`) and unwired
(four-fixed-kind) cases. No new crypto primitive, no new domain, no Rust changes are needed.

## Two real problems Phase A found in the existing unwired code (must be fixed, not just wired)

1. **Forward-secrecy-at-rest gap (Agent S, sharpened by Agent R into a genuinely-vulnerable
   finding, not merely a discipline gap).** `FileFedosDirectRatchetLiveStateSnapshotPersistence`
   is append-forever NDJSON with "last line wins" reads. Wiring it in as-is would durably retain
   every historical sealed chain-key value on disk forever. Combined with Master Seed access,
   this lets an attacker decrypt the session's entire historical key sequence — defeating
   forward secrecy at rest even though in-memory forward secrecy holds. Agent R additionally
   confirmed this is **actively exploitable**, not just a passive-exposure risk: the AEAD sealing
   context binds device/conversation/generation but not chain position, so replaying/restoring
   an older valid NDJSON line rolls the *running* session's chain key backward on the next lazy
   restore — a real rollback, not merely stale data sitting inertly on disk.

2. **"Decrypts successfully" was being treated as sufficient proof of freshness — it isn't**
   (Agent R's INV-LSS-1). A snapshot can be validly sealed, pass AEAD auth, and still be a
   stale/rolled-back chain position.

## Decision

1. **Composition-root wiring**: construct `FileFedosDirectRatchetRemotePublicKeyPersistence`
   and (see #2) a corrected `FileFedosDirectRatchetLiveStateSnapshotPersistence` in
   `fedos_desktop_runtime.ts`'s `directRatchetEnabled` auto-construction, mirroring the exact
   pattern every sibling field already uses (`config.*LogPath !== undefined ? new AppendOnly...`
   pattern — but see #2, the snapshot persistence needs a *different* storage shape, not
   append-only). New config fields: `directRatchetLiveStateSnapshotLogPath`,
   `directRatchetRemotePublicKeyLogPath` (naming to match this file's own established
   convention).

2. **Fix the snapshot storage shape**: change `FileFedosDirectRatchetLiveStateSnapshotPersistence`
   from append-forever NDJSON to atomic rewrite-in-place — one current sealed record per
   `(sessionId, secretKind)` key, mirroring `FileFedosSealedMasterSeedEnvelopePersistence`'s own
   established single-file atomic-write precedent (temp-file-then-rename, this codebase's
   existing durable-write pattern). This closes both the passive-retention and the active-replay
   findings simultaneously: with no historical lines on disk, there is nothing to feed back in.

3. **Freshness check at restore, independent of storage-shape fix (defense in depth, per
   Agent R's INV-LSS-1)**: at restore time, validate the restored snapshot's own chain-position
   marker against the separately, durably-persisted session metadata's own counters
   (`commitCounters()` — confirmed by Agent R to land durably strictly *before* the crypto-state
   checkpoint on both send and receive paths, making it a trustworthy "ratchet position ceiling"
   independent of the snapshot itself). If the restored snapshot's position is behind what the
   durable counters say it should be, reject the restore — do not trust decryption success
   alone. This means even a successfully-restored-from-a-backup-copy old snapshot file (a threat
   the storage-shape fix alone does not cover, since it operates on the CURRENT file only) is
   caught.

4. **Additive Security-UI truthfulness field** (Agent U, unmodified): add
   `FedosDirectRatchetLiveVerificationState` (`"not-applicable" | "live-confirmed-this-process" |
   "restorable-not-yet-confirmed" | "restore-attempted-and-failed" | "no-durable-snapshot"`) as
   a new field alongside the existing `FedosDirectRatchetSafeStatus` union — never a breaking
   rename. Derived by a new pure function from facts already cheaply available (live session
   cache presence, snapshot presence, restore-attempt outcome) that
   `getDirectRatchetStatus()`/`FedosConversationSecurityStateController` currently gather
   nowhere. Wire into Axis 2 (Encryption) and Axis 3 (Forward Secrecy) of
   `deriveConversationSecurityState()` so Forward Secrecy can only read `"good"` when the live
   verification state is `"live-confirmed-this-process"` or a genuinely-succeeded
   `"restorable-not-yet-confirmed"` → confirmed transition — never from stale metadata alone.

5. **Restore stays lazy** (Agent M, unmodified): no eager warm-all-sessions loop at startup.
   Every dependency `#restoreLiveSession()` needs is already constructed before the first
   possible call site. Send-time (`FedosDirectRatchetOutboundIntegration.sendMessage()`) already
   correctly attempts restore and fails closed honestly — this was never broken; only the
   STATUS DISPLAY function was lying.

6. **Legacy sessions fail closed, no invented migration** (Agent M, unmodified): every
   currently-existing session is metadata-only (confirmed root cause: the composition root
   never wired durable snapshot persistence, so it's always been in-memory-only in every real
   process). Live ratchet secret state, once a session has exchanged even one message, is
   provably unrecoverable from anything durable (CSPRNG ephemeral DH keys, one-way HKDF
   advances — confirmed against the actual Rust implementation, not ratchet theory in the
   abstract). `getDirectRatchetStatus()` must distinguish "still live in this never-restarted
   process" (genuinely active) from "no durable snapshot / restore never attempted" (needs
   action) via the new `FedosDirectRatchetLiveVerificationState` field. Recovery is exclusively
   the existing, already-correct, user-initiated Ratchet Reset path — no automatic
   reset-on-restore-failure (a reset sends a real network payload; this codebase already treats
   resets as an explicit, reason-carrying, authorized action everywhere else).

7. **Crash-window between counters and crypto checkpoint: accepted, not engineered around**
   (Agent R's second finding, Agent M's flagged tension resolved). `commitCounters()` landing
   durably before the crypto-state checkpoint means a crash in between leaves counters ahead of
   the actual key material. This **fails closed cryptographically** (no key reuse, no plaintext
   leak — confirmed by Agent R) and simply desyncs the session, requiring the existing Reset
   path. Engineering an atomic combined write across two structurally separate persistence ports
   (session metadata vs. sealed crypto state) to eliminate this narrow, safe-failure window is
   not worth the added complexity — document it as a known, safe, rare edge case with a test
   proving it fails closed rather than silently, not as something requiring a redesign.

## What is explicitly NOT being done

- No new Rust code, no new AEAD/HKDF domain, no new sealing primitive.
- No automatic reset-on-restore-failure.
- No eager restore-everything-at-startup loop.
- No breaking rename of `FedosDirectRatchetSafeStatus`.
- No atomic combined write across counters and crypto-state persistence (accepted safe
  crash window instead, per #7).

See `08_IMPLEMENTATION_PLAN.md` and `09_ACCEPTANCE_MATRIX.md` for the ordered execution plan
and test matrix.

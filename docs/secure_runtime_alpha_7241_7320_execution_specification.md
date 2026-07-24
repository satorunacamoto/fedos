# Secure Runtime Alpha 7241–7320 — Execution Specification

**FedOS Long-Running Runtime Reliability and Recovery Arc.**

Resumes from Secure Runtime Alpha 7161–7240 (`b4fa2d7f`, branch
`arc/fedos-conversation-level-production-crypto-identity-wiring`). This
Arc runs in a dedicated worktree/branch,
`arc/fedos-long-running-runtime-reliability-recovery`, base `b4fa2d7f`.

## Mission (as given)

Validate and harden the already-real production runtime under realistic
long-running conditions. Explicitly forbidden: any new cryptographic
protocol, any redesign of Ratchet, Identity, NIP-17, or Secure Memory.

## Required scope, and how each item was closed

1. **Long-running Conversation durability** —
   `test/secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts`:
   221 real, WASM-encrypted messages across 2 full restarts and 1 genuine
   relay disconnect/reconnect, all over a real local WebSocket relay, two
   real independently-provisioned production profiles. Proves no message
   loss, no duplicate delivery, no decrypt corruption throughout.
2. **Relay disconnect/reconnect recovery** — the same file's own
   dedicated phase (`WebSocketRelay.disconnect()`/`connect()`, Alpha
   214/215, unmodified), plus `failure_matrix.test.ts` test 4 (two
   consecutive disconnect/reconnect cycles). No new reconnect/backoff
   policy is added — `FedosConversationRelaySet`'s own documented "no
   reconnect policy of any kind" contract is unchanged; what is proven is
   that the durable Outbox/Scheduler (Alpha 1471–1540, unmodified) never
   loses a pending intent across a disconnect, retrying it automatically
   once the SAME held relay instance reconnects.
3. **Ratchet persistence across repeated restarts** —
   `test/secure_runtime_alpha_7241_7320_direct_ratchet_repeated_restart.test.ts`:
   extends the existing single-cycle proof
   (`secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts`,
   unmodified) to FOUR consecutive real seal → clear → fresh-generation →
   restore cycles, with real messages exchanged between every cycle,
   proving counters/chain state/decryptability all remain correct across
   repeated (not just one) restart boundaries. Zero change to
   `FedosDirectRatchetCryptographicSession`'s own logic.
4. **Identity Transition during active conversations** —
   `test/secure_runtime_alpha_7241_7320_identity_transition_active_conversation.test.ts`:
   a real, live, two-profile, real-relay Direct conversation with real
   messages sent both before and after a real Identity Transition
   notification arrives for the recipient mid-conversation; the
   recipient's real accept decision is recorded, survives a real restart
   of both sides, and the conversation continues delivering real messages
   afterward. Disclosed boundary: the production Runtime/Shell wires only
   the RECEIVING side of Identity Transition; no Shell method exists to
   INITIATE one (a real, pre-existing gap, not this Arc's own to close) —
   the notification's own real, signed artifacts are handed to the
   recipient's real Conversation Runtime via `receiveNip17Rumor()`, the
   same real import pathway a relay-delivered Rumor would reach, exactly
   mirroring the established
   `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
   precedent. Zero change to Identity Transition's own record/proof/
   decision model.
5. **Signed Deletion during active conversations** —
   `test/secure_runtime_alpha_7241_7320_retention_durability_active_conversation.test.ts`:
   exercises retention (Signed Deletion's own underlying effect) at the
   layer this codebase's own established `secure_runtime_alpha_3081_3160_content_accessor.test.ts`
   precedent already uses ("out-of-band retention transition, over the
   SAME durable retention/payload log paths this running Runtime already
   uses"), embedded in a real, live, two-profile, real-relay conversation,
   with a REAL restart across the tombstone — the prior precedent never
   restarted at all. Disclosed boundary: the full Signed Deletion Request
   WIRE protocol requires the recipient's Device to already be registered
   in the requester's own real Device Registry via a real Device Pairing
   handshake — a separate, un-scoped subsystem this Arc does not build.
6. **Archive/Search/Retention interaction** — closed via TWO real
   production fixes (below) plus
   `test/secure_runtime_alpha_7241_7320_archive_search_retention_interaction.test.ts`:
   a real, live, two-profile conversation, one message tombstoned
   mid-conversation, a real WASM-encrypted export, and a genuinely fresh
   "new device" Runtime restoring that archive — the tombstoned message's
   payload never crosses the device boundary at all (this Arc's own
   Archive/retention fix), while every kept message's payload restores
   intact.
7. **Multi-conversation isolation** —
   `test/secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`,
   two tests. Test 1 (the supported case): Alice's two real, concurrently-
   live Direct conversations with two DIFFERENT real peers (Bob, Carol)
   stay fully isolated — message lists, plaintext, and Search results
   never cross-contaminate, before or after a real restart of all three
   profiles. Test 2 (a real, disclosed finding): two concurrent real
   Direct conversations with the SAME peer are NOT correctly isolated by
   inbound routing — confirmed live. `resolveFedosPrivateNostrInboundDirectConversation()`
   (Alpha 1424, unmodified) resolves an inbound Rumor's target Conversation
   by the sender's pubkey alone; NIP-17's own `kind:14` Rumor wire format
   carries no conversation identifier at all, so a second concurrent
   conversation with the same peer silently receives every inbound
   message misrouted into the FIRST (earlier-created) conversation
   instead. This is a real, structural, previously-undocumented
   limitation, not fabricated or exaggerated — and NOT fixed here: a real
   fix would require embedding an explicit conversation identifier into
   the NIP-17 wire payload, which is a wire-format change this Arc's own
   mission explicitly forbids as protocol redesign. Disclosed for a
   future Arc to weigh.
8. **Failure matrix** — `test/secure_runtime_alpha_7241_7320_failure_matrix.test.ts`,
   5 tests: real relay re-delivery of the same event never duplicates; a
   message sent shortly before a real restart (Outbox intent still
   pending) is delivered exactly once after the restart, never lost or
   duplicated; THREE consecutive real restarts preserve the exact message
   count each time; two consecutive real disconnect/reconnect cycles both
   recover cleanly; this Arc's own Capability/Retention log-path fix
   genuinely produces real, on-disk, cross-restart-durable log files
   through the real Coordinator path.
9. **Structural guards** — `test/secure_runtime_alpha_7241_7320_structural_guards.test.ts`,
   10/10 passing (see below).
10. **Real production vertical slice** — every test file above drives the
    real `FedosProfileInitializationCoordinator` → `startFedosDesktopRuntime()`
    chain, a real local WebSocket relay server, real WASM crypto (a real
    `packages/fedos-core-rust/pkg/` artifact was built for this session),
    real file-backed persistence. No mocks, no fake relay, anywhere in
    this Arc's own new test files.

## Two real production fixes made

Both are narrow, additive, and mirror pre-existing, established patterns
in this codebase exactly — no new persistence port, no new crypto
primitive, no protocol change.

### Fix 1 — Capability/Retention state silently fell back to in-memory through the real Coordinator path

`FedosDesktopRuntimeConfig.conversationCapabilityLogPath`/
`conversationPayloadRetentionLogPath` ALREADY existed (Alpha 923/1143) and
`startFedosDesktopRuntime()` ALREADY wires a real, durable
`AppendOnlyFedosConversationCapabilityPersistence`/
`AppendOnlyFedosPayloadRetentionPersistence` when a path is supplied — but
`FedosProfileInitializationCoordinator` never supplied either path, and
`fedos_local_profile_paths.ts` never even planned a leaf file for them.
The real production Coordinator path therefore silently fell back to
in-memory-only persistence — meaning any retention decision (e.g. what a
granted Signed Deletion Request's own reconciliation would produce) was
SILENTLY LOST on every real restart. This is the exact same bug CLASS
Alpha 7081-7160 found and fixed for `conversationDraftLogPath` (see that
file's own doc comment on the sibling field, unmodified).

Fixed by:
- `fedos_local_profile_paths.ts`: two new leaf fields, `conversationCapabilityLogFile`
  (`conversation-capability.ndjson`) and `conversationPayloadRetentionLogFile`
  (`conversation-payload-retention.ndjson`).
- `fedos_profile_initialization_coordinator.ts`: two new unconditional
  pass-through lines threading them into `FedosDesktopRuntimeConfig`,
  mirroring `conversationMembershipLogPath`/`conversationDraftLogPath`'s
  own identical, unconditional discipline.

Regression-proven by
`test/secure_runtime_alpha_7241_7320_retention_durability_active_conversation.test.ts`
(a tombstone genuinely surviving a real restart of a live conversation)
and `failure_matrix.test.ts` test 5 (direct on-disk existence + fresh-
generation read-back for both paths).

### Fix 2 — Archive export/restore never enforced Payload Retention, and never had a real WASM-backed encryption boundary

Two independent, previously-undiscovered gaps in
`FedosConversationArchiveRuntime`/`fedos_conversation_archive_collector.ts`,
found via direct testing (no prior test ever had both a real `pkg/`
artifact AND a real production Master Seed Authority to exercise
Archive's real crypto path all the way through):

**2a — Retention never gated Archive.** Search closed the identical gap
at Alpha 2581-2620 (`evaluatePayloadAccess()` gating ingestion); Archive's
own equivalent gap was independently found by a concurrent Release
Readiness Review (`docs/reviews/release_readiness_alpha_7161_7240/`) and
is closed here by mirroring Search's own established pattern exactly:
`fedos_conversation_archive_collector.ts` gains one narrow, OPTIONAL,
additive dependency, `retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">`,
and filters `payloadDescriptors` (never `envelopes`/`memberships`/
`capabilityEvents`) through the SAME fail-closed `#isPermitted()`
discipline Search's own Alpha 2581-2620 fix already established. Threaded
through `FedosConversationArchiveRuntimeDependencies`/
`FedosConversationArchiveRuntimeAssemblyConfig` to a NEW second
`FedosPayloadRetentionAuthority` instance in `fedos_desktop_runtime.ts`,
over the SAME durable retention log Fix 1 above makes real — mirroring
`conversationArchiveMembershipPersistence`/`conversationArchiveCapabilityPersistence`'s
own already-established "second port instance, same durable backend"
pattern exactly. Omitted entirely, Archive's own behavior is byte-for-
byte unchanged from before this Arc.

**2b — Archive's own encryption authority never had a production-path
boundary.** `FedosWasmConversationArchiveEncryptionAuthority`'s DEFAULT
`fedosConversationArchiveEncryptionRuntimeBoundary` calls
`fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/
`fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`
— the SAME recurring bug class Alpha 7161-7240 already fixed for the
generic Envelope-AEAD path: each of those four files constructs its OWN,
fresh, `NODE_ENV=development`-gated `FedosWasmLoaderSkeleton` instance per
call, never the canonical, already-activated production authority. Real
testing proved this live: Archive export genuinely failed ("failed",
never a fabricated success) outside `NODE_ENV=development`, even with a
real `pkg/` artifact and a real, already-activated production Master Seed
Authority present, because Archive never had a production-path boundary
to fall back to at all — unlike the generic Envelope path, which Alpha
7161-7240 already fixed via
`FedosProductionConversationEncryptionRuntimeBoundary`/
`DecryptionRuntimeBoundary`. Closed via the new
`FedosProductionConversationArchiveEncryptionRuntimeBoundary`
(`src/desktop/production_activation/fedos_production_conversation_archive_encryption_runtime_boundary.ts`),
a thin adapter reusing the EXACT SAME already-real, already-tested
`FedosProductionConversationAeadHandleSource` shape
(`encryptAead`/`decryptAead`/`serializeAeadCiphertext`/
`deserializeAeadCiphertext`) Alpha 7161-7240 already added to
`FedosProductionMasterSeedAuthority` — no new Rust/WASM capability of any
kind. Wired via a structural type-guard,
`isFedosProductionConversationAeadHandleSource()`, mirroring
`isFedosProductionEphemeralGiftWrapHandleSource()`'s own exact discipline
— any `FedosMasterSeedAuthority` without the four production accessors
keeps using the existing dev-gated default, zero regression.

Both proven live by
`test/secure_runtime_alpha_7241_7320_archive_search_retention_interaction.test.ts`:
real WASM-backed export, inspect, and preflight all succeed; the
tombstoned payload is verifiably excluded from the exported bundle
(`payloadCount: 2` vs `envelopeCount: 3`); a genuinely fresh Runtime
generation restores it and the tombstoned message's payload never
resurfaces.

## A genuine long-running-reliability characteristic, disclosed (not fixed)

`AppendOnlyFedosConversationTransportOutboxPersistence.listIntents()`
replays the ENTIRE append-only log file from disk on every call — O(total
ever appended) work, invoked every single Scheduler tick. Measured
directly: in a single long-running conversation, an equal-sized later
burst of messages took measurably longer to fully deliver than an earlier
burst of the same size, because the tick cost compounds with the
conversation's own growing history. Not fixed here — this exact
replay-per-call pattern is widespread across many persistence classes in
this codebase (a real, existing, consistent architectural choice), and
changing it for Outbox alone (without an incremental-read capability at
the persistence-port level) would be an inconsistent, unscoped change,
not a narrow harden. Disclosed for a future Arc to weigh; this Arc's own
long-running test accounts for it with a generous, honest per-burst time
budget rather than hiding it behind an artificially short one.

## Verification

- `npx tsc --noEmit` — clean (the same 2 known pre-existing baseline
  errors as the immediately-prior Arc, unrelated to this Arc's own
  files).
- `cargo test` — 639/640 (the same 1 pre-existing, unrelated
  Cargo.toml dependency-count drift; zero Rust files touched, confirmed
  by structural guard test 1/2).
- WASM build — a real `packages/fedos-core-rust/pkg/` artifact was built
  fresh for this session (`cargo build --target wasm32-unknown-unknown
  --release` + `wasm-bindgen`) and used throughout every real test in
  this Arc, including — for the first time — Archive's own real,
  WASM-backed export/restore path.
- Targeted suites — this Arc's own 8 new test files (22/22 passing), plus
  the full pre-existing Archive/Search/content-accessor regression suite
  (`secure_runtime_alpha_1691_1760_*`, `secure_runtime_alpha_1921_1980_*`,
  `secure_runtime_alpha_2601_2620_*`, `secure_runtime_alpha_3081_3160_*`,
  10 files / 119 tests, all still passing after this Arc's own Archive
  retention/encryption-boundary changes) plus the immediately-prior Arc's
  own two real production vertical slice tests (`6521_6600`/`7161_7240`,
  still passing).
- Full regression — see this commit's own verification log for the
  complete `npx vitest run` diff against the pre-Arc baseline.

## Environment note (not a code change)

Building the real WASM artifact in this worktree initially failed
(`ld.exe: cannot find ... list.def`/similar) when Cargo's default target
directory sat under the long, OneDrive-synced, Japanese-character repo
path — resolved by pointing `CARGO_TARGET_DIR` at a path outside the
OneDrive-synced tree for the build step only. No repository file changed
as a result; this is a local build-environment note, not a checked-in
`.cargo/config.toml` (this project's own established policy, unchanged).

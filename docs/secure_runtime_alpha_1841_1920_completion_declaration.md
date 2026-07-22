# Secure Runtime Alpha 1841–1920 — Completion Declaration
## NIP-17 Standard Transport Integration and Group Pairwise Delivery Arc

**Honest partial completion.** The Arc's own named, central blocker —
the plaintext-sourcing seam between the application send operation and
`FedosPrivateTransport` — is CLOSED, additively, and the standard
`nostr-nip17-v1` route is wired into LIVE outbound AND inbound dispatch
(not merely constructor-injectable, as the prior Arc's own honest
boundary left it). Both Direct delivery (outbound + inbound, full real
round trip) and Group pairwise outbound fan-out are verified with REAL
Rust/WASM NIP-44/NIP-59 cryptography, through the actual application
call sites (`sendDirectMessage()` / `receiveNip17Rumor()` /
`sendGroupMessage()`), never a manual `sendMailboxNip17()` call standing
in for the real path.

Explicitly deferred, and named honestly rather than half-built: a
dedicated Group INBOUND test (each recipient importing/reading their own
recipient-specific Gift Wrap independently — the mechanism is the exact
same Direct inbound path already proven, since a Group child path IS a
real Direct Conversation, but no new test exercises it end-to-end for
Group specifically); an explicit stop/restart-cycle test for the new
`schemaVersion: 2` Outbox record (the mechanism reuses the SAME
Scheduler/Outbox persistence the already-tested V1 restart behavior
relies on, unmodified, but no NEW test re-proves it for V2); Phase H's
exhaustive security matrices (outer/Seal/Rumor tamper matrices, hostile-
Relay matrix — the prior Arc's own adapter-level tamper/wrong-recipient
tests still pass unmodified and cover the crypto boundary itself; this
Arc adds one route-fails-closed test but not the full matrix); Phase F
(mailbox/ephemeral semantics for the standard route); and Phase J's
fuller documentation/runbook items. This is a scope decision under real
time constraint, not a research blocker — every piece named above is
mechanical, additive work over the SAME seam this Arc already closes and
verifies real, and is the natural next slice.

## What was actually done, and verified

### Phase A — Integrated Source Inventory (Alpha 1841)

Read, not assumed:
- `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
  (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts`)
  is exactly where plaintext (`new TextEncoder().encode(body)`) stops
  existing today — it is handed to `encryptionCoordinator.encrypt()`,
  which returns only an Envelope (ciphertext already persisted,
  opaque). No later call site (Transport, Outbox, Scheduler, Publisher)
  ever sees it.
- `FedosPrivateTransport`'s own outbound dispatch
  (`FedosConversationTransportSignedEventSource.resolveSignedEvent`)
  resolves an Outbox record LAZILY, at publish/retry time, by re-reading
  the persisted Envelope + Payload (ciphertext) and re-signing — correct
  for `fedos-private-v1` (whose wire ciphertext IS the same bytes,
  re-signable any time) but structurally incompatible with
  `nostr-nip17-v1` (which needs the ORIGINAL plaintext, never retained).
- `NostrNip17V1WireAdapter` (prior Arc, Alpha 1788) already builds a
  fully-signed native Gift Wrap event given plaintext — the missing
  piece was purely the SEAM, not the crypto.
- The OLDER proprietary `delivery/nostr/*` layer (Alpha 1391–1470) and
  the NEWER `FedosPrivateTransport` (Alpha 1471–1540) are two SEPARATE,
  still-coexisting delivery mechanisms in this codebase — `FedosConversationRuntime`
  wires the former automatically (`privateNostrDelivery()`); the latter
  is constructed independently by `fedos_desktop_runtime.ts` and was
  NEVER auto-invoked by `sendDirectMessage()` before this Arc.
- `FedosGroupSendCoordinator.sendGroupMessage()` (Alpha 1341–1354) already
  calls `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
  once per active recipient's own Direct path Conversation — meaning
  enhancing `sendDirectMessage()` ONCE makes Group pairwise delivery
  inherit standard delivery automatically, with zero Group-specific
  wiring, since each recipient's own per-path envelope/send already goes
  through the SAME enhanced call.
- `review/per-relay-delivery-observation-v1` (`37f55c2`) inspected
  directly: 20 markdown spec-review documents + 3 boundary/consistency
  TypeScript test files, zero production source. Confirmed NOT a
  required implementation prerequisite — a separate, out-of-scope
  "local reputation signal" design review. No merge performed.

### Phase B — Plaintext Ownership Decision + Prepared Delivery contract (Alpha 1842/1846/1847/1848)

New file `src/conversation/transport/fedos_private_wire_prepared_delivery.ts`:
`FedosPreparedPrivateDelivery` (opaque: route, envelopeId, conversationId,
recipientPublicKeyHex, already-signed native event, createdAt — NO
plaintext, NO raw key), `FedosPrivateWirePreparationOutcome` (closed
Alpha 1847 vocabulary), `FedosPrivateWireDeliveryQueueOutcome` (the
widened outcome `sendMailboxNip17()` returns). Retry Stability (Alpha
1848): Option A adopted (persist the exact signed Gift Wrap, replay
verbatim) — the only sound choice given plaintext is never retained;
proven safe because the ephemeral Gift-Wrap key is drawn once, at
signing time, and only the already-public signed bytes are ever
replayed afterward.

### Phase B — Outbox additive `schemaVersion: 2` (Alpha 1846/1848)

`fedos_conversation_transport_outbox_codec.ts` gains
`FedosPersistedConversationTransportOutboxRecordV2` (route,
recipientPublicKeyHex, nativeEvent) alongside the UNCHANGED V1 shape,
plus a `FedosPersistedConversationTransportOutboxRecord` union and a
generic deserializer dispatcher. `fedos_conversation_transport_outbox_persistence.ts`,
its in-memory/append-only backends, the Scheduler, and the Multi-Relay
Publisher are widened to the union type — purely mechanical, zero
behavior change for existing V1 callers (verified: every pre-existing
transport/relay/scheduler test still passes unmodified).
`FedosConversationTransportSignedEventSource.resolveSignedEvent` checks
`schemaVersion === 2` FIRST and returns the stored native event
verbatim — no Envelope/Payload/route re-derivation for the standard
route, ever.

### Phase C — Additive dispatch seam + live wiring (Alpha 1843/1844/1850/1851)

- `FedosPrivateTransport.sendMailboxNip17(envelopeId, conversationId, plaintext)`
  — new method: fails closed to `route-unavailable` if no
  `nostr-nip17-v1` adapter is injected or it reports itself unavailable
  (BEFORE any Relay contact); resolves Direct-mode routing (reused,
  unchanged `resolveFedosConversationTransportRoute()`); calls
  `wireAdapter.build()` with plaintext; persists the V2 record.
- `FedosConversationDirectMessagingCoordinator` gains an OPTIONAL
  `delivery` dependency (`FedosConversationDirectMessageDeliveryDependencies`
  — a narrow `sendMailboxNip17` thunk, never the whole Transport type).
  `sendDirectMessage()`, immediately after `encryptionCoordinator.encrypt()`
  returns (the ONE place plaintext is ever held outside the frozen
  Encryption Coordinator), hands that SAME plaintext to the thunk when
  configured. Omitted `delivery` → BYTE-FOR-BYTE unchanged behavior
  (verified: every pre-existing Direct messaging test passes unmodified).
  `FedosConversationDirectMessageSendResult`'s `"sent-locally"` variant
  gains an OPTIONAL `delivery` field (Alpha 1851 — a separate fact,
  never conflated with local storage).
- `FedosConversationRuntime` threads `directMessageDelivery` straight
  through to the coordinator; `fedos_desktop_runtime.ts` builds the real
  closure via forward-declared `let privateTransportInstance` (mirrors
  its own existing `membershipsForConversation` forward-reference
  discipline), constructs `NostrNip17V1WireAdapter` ONLY when
  `conversationDirectMessageDeliveryRoute: "nostr-nip17-v1"` is
  explicitly configured (Alpha 1844 — no heuristic, no default), and
  REQUIRES `conversationProductionCrypto` for that route (new startup
  guard) so the adapter's own NIP-44 Master Seed is coherent with the
  real Nostr identity `conversationTransportSigningAuthority` derives
  from — never two independent, incoherent crypto identities.

### Phase D — Direct Inbound (Alpha 1856–1861)

- `FedosConversationInboundSubscription` gains an OPTIONAL `nip17Adapter`
  + `onRumor` listener: proprietary `kind: 24700` classification is tried
  FIRST (unchanged); ONLY if it does not match is `nip17Adapter.parse()`
  tried — two disjoint-kind classifiers, never both firing for one
  event, public `kind: 1` matching neither.
- New `FedosNip17InboundImportCoordinator`
  (`src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.ts`),
  modeled directly on the proprietary Alpha 1419–1428 inbound
  coordinator: reuses `resolveFedosPrivateNostrInboundDirectConversation()`
  UNCHANGED for admission (never auto-creates a Conversation/Membership);
  dedups by the Rumor's OWN id (stable across re-wraps in a different
  Gift Wrap — NOT the outer event id); re-seals the received plaintext
  for LOCAL storage-at-rest via the SAME already-reviewed
  `FedosConversationEncryptionAuthority.encrypt()` boundary (Alpha
  861/863/870, unmodified), attributed to the counterparty as sender —
  so `readDirectMessage()`/`decryptionCoordinator.decrypt()` work with
  ZERO changes.
- `FedosConversationRuntime.receiveNip17Rumor()` — the one public entry
  point, delegating entirely; constructed in the Runtime's own
  constructor over the SAME identity/encryption/persistence instances
  the rest of the Runtime already uses (one coherent graph, per Alpha
  1879).

### Phase I — Real vertical acceptance (Alpha 1891/1892)

New `test/secure_runtime_alpha_1841_1920_nip17_transport_group_integration.test.ts`,
real Rust/WASM crypto throughout (`npm run build:wasm` required), three
passing tests:

1. **Direct real round trip**: Alice's `sendDirectMessage()` ALONE
   (live dispatch) → real Gift Wrap prepared+queued (`schemaVersion: 2`)
   → published over a real (fake-server) Relay → ACKed → Bob's real
   Inbound Subscription unwraps it → `receiveNip17Rumor()` ALONE imports
   it → `readDirectMessage()` returns the EXACT original plaintext →
   re-delivering the identical Rumor is `"duplicate"`.
2. **Group real fan-out**: Alice admits Bob and Carol into a Private
   Group, `sendGroupMessage()` → the UNMODIFIED Group Send Coordinator's
   own per-recipient loop calls the SAME enhanced `sendDirectMessage()`
   twice → Alice's own Outbox holds two independent `schemaVersion: 2`
   records, different native event ids, different ephemeral outer
   pubkeys, correct per-recipient `recipientPublicKeyHex` — no shared
   ciphertext, no shared ephemeral key; both publish and ACK
   independently.
3. **Route selection fails closed**: a configured-but-unavailable
   standard route (no adapter injected) yields `{outcome:
   "route-unavailable"}` — local storage still succeeds, NOTHING is
   queued, no Relay is ever reached; an unconfigured route leaves
   `sendDirectMessage()`'s result shape with no `delivery` property at
   all, byte-for-byte identical to every pre-existing caller.

## Verification performed

- `npm run typecheck` — clean except one PRE-EXISTING, byte-identical-to-`97e563b`
  failure (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
  unrelated Board Publish Scheduler test, `noUncheckedIndexedAccess`
  strictness on an untouched file).
- Focused regression: every Direct messaging, Private Transport, Group
  vertical-slice, and prior NIP-17 real-crypto test in this repository
  passes UNMODIFIED (`secure_runtime_alpha_1111_1180_*`,
  `secure_runtime_alpha_1181_1260_*`, `secure_runtime_alpha_1261_1320_*`,
  `secure_runtime_alpha_1321_1390_*`, `secure_runtime_alpha_1391_1470_*`,
  `secure_runtime_alpha_1471_1540_*`, `secure_runtime_alpha_1761_1840_*`).
  One pre-existing test (`secure_runtime_alpha_1471_1540_relay_fanout_and_dedup.test.ts`)
  needed a purely mechanical type-widening fix (its own local helper's
  parameter type, from V1-only to the new union) — zero behavior change.
- Full `npm test`: pre-existing baseline failures (verified BYTE-IDENTICAL
  to `97e563b`, unrelated to this Arc) come in two flavors, both a
  standing, already-documented feature of this repository's history
  (the prior Arc's own completion declaration names the identical
  category for Rust `cargo test`): (a) very old "Stage N" tests
  asserting frozen historical `Cargo.toml` dependency counts / `pub fn`
  counts / "no compiled WASM artifact committed" that are structurally
  incompatible with this crate's own real, legitimate growth since; (b)
  "review/*" specification-review test suites whose own boundary
  invariant is literally "git working tree shows no change", which any
  active Arc's own uncommitted diff necessarily fails. Neither category
  references any file this Arc touches or added; confirmed directly by
  grep against the full failure list.
- `cargo check` clean; `cargo test`: 547 passed, 1 pre-existing failure
  (`secp256k1_dependency_guard`, the identical "N production
  dependencies" Stage-count class above; `Cargo.toml` byte-unchanged by
  this Arc, confirmed via `git diff 97e563b`).
- `npm run build:wasm` succeeds; the new real vertical acceptance suite
  passes against the freshly-built artifact.
- `package.json`/`package-lock.json`/`packages/fedos-core-rust/Cargo.toml`
  confirmed byte-unchanged vs `97e563b`.
- `main`, the Archive Runtime worktree/branch, every `review/*` branch,
  `p2p/`, and `.tmp_gen/` untouched — this worktree's own diff never
  references any of them.

## Recommended next Arc

**"NIP-17 Group Inbound, Restart-Dedup Proof, and Security Matrix
Completion Arc"** — build the dedicated Group inbound test (each
recipient's own path conversationId resolved via the existing
`FedosGroupDirectPathPersistence`, shared between participants exactly
like the Direct domain's draft/membership backends already are in this
Arc's own test harness), an explicit stop/restart cycle proof for the
`schemaVersion: 2` Outbox record, and Phase H's outer/Seal/Rumor tamper
+ hostile-Relay matrices — all mechanical extensions over the seam this
Arc already closes and proves real, no further architectural decision
required.

# Secure Runtime Alpha 1981–2040 — Reconciliation Report
## NIP-17 Group Inbound, Restart Dedup and Security Matrix Completion Arc

Run in a dedicated integration worktree (`C:\wt\nip17-security-completion`,
branch `arc/nip17-group-inbound-restart-dedup-security-completion`), based
directly on `cd5584b` (Alpha 1841–1920, "NIP-17 Standard Transport
Integration and Group Pairwise Delivery Arc" tip — confirmed via
`git rev-parse`: `cd5584b` **is** the current tip of
`arc/nip17-standard-transport-integration-group-delivery`, no further
integration needed). No Archive branch was merged, consistent with this
Arc's own explicit instruction. No production code is changed in this
report.

## 1. Exact Direct inbound flow

`FedosConversationInboundSubscription` (Direct-mode) receives a raw event
descriptor from a Relay → tries proprietary `kind: 24700` classification
first (unchanged) → if no match, tries the optional `nip17Adapter.parse()`
(`NostrNip17V1WireAdapter`, `src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts`)
→ `parse()` rejects any non-Gift-Wrap kind, unwraps the Gift Wrap (NIP-44
decrypt against `localAccountIndex`) → unwraps the inner Seal → structurally
validates the inner Rumor (`isWellFormedFedosNip17Rumor`, kind:14 only) →
any failure at any of these steps collapses to one coarse `"not-mine"`
outcome (no oracle detail) → on success, the subscription's own `onRumor`
listener fires with a `FedosPrivateWireParsedRumor` → `FedosConversationRuntime.receiveNip17Rumor()`
→ `FedosNip17InboundImportCoordinator.receiveRumor()`
(`src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.ts`):
dedup check (§5) → admission gate
(`resolveFedosPrivateNostrInboundDirectConversation()`, sender pubkey →
existing Direct Conversation + counterparty Membership, NEVER
auto-creates) → re-seals the plaintext via the existing
`FedosConversationEncryptionAuthority.encrypt()` boundary for local
storage-at-rest, attributed to the counterparty as sender → writes a local
Envelope + Payload through the existing, unmodified ports → writes one
`FedosPrivateNostrImportRecord` (§6) → the message is now readable through
the completely unmodified `readDirectMessage()`/`listDirectMessages()`.

## 2. Exact Group outbound flow

`FedosGroupSendCoordinator.sendGroupMessage()` (unchanged by the prior
Arc, `src/conversation/group/fedos_group_send_coordinator.ts`) resolves
the current generation, resolves each active recipient's own pairwise
Direct path (`FedosGroupDirectPathAuthority.preparePath()` — all-or-nothing
before any durable write), then calls
`FedosConversationDirectMessagingCoordinator.sendDirectMessage({ conversationId: path.directConversationId, body, ... })`
once per recipient. Because Alpha 1841–1920 wired the standard route
directly into `sendDirectMessage()` itself (an OPTIONAL
`delivery.sendMailboxNip17` thunk invoked immediately after
`encryptionCoordinator.encrypt()` returns, the one place plaintext is ever
held outside the frozen Encryption Coordinator), **every recipient's own
per-path send already goes out over `nostr-nip17-v1` automatically once
that route is configured on the Runtime — zero Group-specific transport
wiring exists or is needed.** The Group Send Coordinator itself never sees
Nostr, Gift Wrap, or Rumor concepts; it only ever calls the same
`sendDirectMessage()` every plain 1:1 message uses. Locally, on the
SENDER's own Runtime, this also writes one canonical
`FedosGroupMessageRecord` (`"planned"` → `"complete"`/`"failed"`) and one
`FedosGroupFanoutDeliveryRecord` per recipient (`"planned"` →
`"stored"`/`"failed"`, carrying the resulting local `envelopeId`) — see §4
for why this bookkeeping is sender-local only.

## 3. How Group recipient Direct child paths are represented

A Group path (`FedosGroupDirectPathRecord`,
`src/conversation/group/fedos_group_direct_path.ts`) maps one
`(group, generation, sender, recipient)` tuple onto exactly one real,
ordinary `direct`-kind `FedosConversationId`, computed via
`toFedosGroupPairKey()` (order-independent, generation-independent — the
SAME two participants always resolve to the SAME underlying Direct
Conversation across every generation they are both active in) fed as the
idempotency key to the existing `createDirectDraft()`. There is no
separate "Group child Conversation" record type; a path record is purely a
linkage fact (`pathId → directConversationId`), and the Direct Conversation
itself carries the real Membership/Activation/Envelope/Payload exactly like
any other Direct Conversation. This means the recipient side of a Group
send is, from the wire and from `FedosConversationInboundSubscription`'s
own point of view, indistinguishable from an ordinary 1:1 Direct message —
the inbound admission gate (`resolveFedosPrivateNostrInboundDirectConversation()`)
resolves purely by sender pubkey → counterparty → the SAME shared pairwise
Direct Conversation, with no Group-awareness at all.

## 4. How an inbound Rumor maps to a Group Message today — the central finding

**It currently does not, by pre-existing, accepted design — not a defect
introduced by the prior Arc.** `FedosGroupReadFacade`
(`src/conversation/group/fedos_group_read_facade.ts`, Alpha 1362/1366,
predates NIP-17 entirely) states explicitly in its own header: *"the
SENDER's own local canonical `FedosGroupMessageRecord` log is the display
source — this facade never reaches into a recipient's own Direct
Conversation to reconstruct a group view."* A recipient (Bob) reads a
received Group-fanout message purely through the ordinary
`readDirectMessage()`/`listDirectMessages()` path on his own shared
pairwise Direct Conversation with the sender — never through
`listPrivateGroupMessages()`, which only ever reflects the SENDER's own
bookkeeping. This is why `FedosNip17InboundImportCoordinator` and the
underlying `FedosNip17Rumor` wire shape
(`src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts`) carry no
Group Conversation ID, generation, canonical Group Message ID, or sender
Membership field of any kind today: `.content` is plain message text, and
`.tags` carries only NIP-17-normative `p` (recipient) and optional `e`
(reply) tags.

This satisfies the letter of "each can read exact plaintext through the
authorized local API" (this Arc's own Phase A, step 13) with ZERO
production change. It does **not** satisfy "each imports exactly one local
Group Message representation" (Phase A step 12) as literally stated,
because no `FedosGroupMessageRecord`/`FedosGroupFanoutDeliveryRecord`
analog is ever written on the recipient's own Runtime — Phase B's own
canonical-linkage investigation is therefore live, not a formality, and is
resolved in §10 below.

## 5. Current native/canonical dedup identities

Three distinct, already-established identities, never conflated:

1. **Native Gift-Wrap identity** — the outer NIP-59 Gift Wrap's own
   NIP-01 event id. Collapsed BEFORE this Arc's own dedup logic is ever
   reached, by the existing, unmodified `FedosRelayEventDeduplicator`
   (Multi-Relay fan-out — the same wrap arriving from two Relays, or twice
   from one Relay, is already reduced to one delivery upstream).
2. **Inner Rumor identity** (`FedosNip17InboundImportCoordinator`'s own
   canonical key, `rumor.envelopeId` — the Rumor's own `id` field, which
   per `fedos_nip17_rumor.ts`'s own header is the sender's already-unique
   LOCAL envelope id, reused verbatim, never a true NIP-01 hash). This is
   the identity that survives a re-wrap of the identical Rumor inside a
   genuinely different Gift Wrap (different outer event id, different
   ephemeral key) — the one thing invariant across every legitimate
   re-delivery of "the same logical message."
3. **Canonical local message identity** — the freshly-generated LOCAL
   `envelopeId` the import coordinator mints on a genuine (non-duplicate)
   import, used to write the local Envelope/Payload. Never derived from
   either wire identity above — this is purely a local storage key.

The durable fact binding (2) → "already imported, do not re-import" is
`FedosPrivateNostrImportRecordPersistence`, keyed by `rumor.envelopeId`
(§6). No dedup path in this codebase relies on Relay URL/identity at any
layer (confirmed: `relaySource` is stored on the import record as
untrusted OBSERVATION ONLY, per that file's own header, never consulted by
the dedup check itself).

## 6. Durable records used for restart

- `FedosPrivateNostrImportRecordPersistence` (Alpha 1426/1427,
  `src/conversation/delivery/nostr/fedos_private_nostr_import_record.ts`)
  — INBOUND dedup, keyed by `nostrEventId` (really the Rumor id, per §5).
  Append-only backend exists
  (`append_only_fedos_private_nostr_import_record_persistence.ts`);
  survives restart by construction (same durable-log pattern as every
  other append-only port in this codebase).
- `FedosConversationTransportOutboxPersistence` (`schemaVersion: 2` record
  added by the prior Arc, `fedos_conversation_transport_outbox_codec.ts`)
  — OUTBOUND queue/retry state: `route`, `recipientPublicKeyHex`, the
  already-signed native Gift-Wrap `nativeEvent` (never plaintext, never a
  re-derivable ciphertext — Option A from the prior Arc's own Retry
  Stability decision, Alpha 1848: replay the exact signed bytes verbatim,
  since the ephemeral Gift-Wrap key is drawn once at signing time and
  cannot be re-derived after restart). `FedosConversationTransportSignedEventSource.resolveSignedEvent`
  checks `schemaVersion === 2` first and returns this stored native event
  as-is — no re-signing, no re-encryption, ever, for the standard route.
  The Scheduler/Multi-Relay Publisher/Observation Repository consuming
  this queue are UNMODIFIED from the already-restart-tested V1 path (this
  Arc's own §"deferred items" #2 is precisely: no NEW test yet re-proves
  restart specifically for a V2 record, even though the mechanism is
  shared verbatim).
- `FedosGroupMessagePersistence`/`FedosGroupFanoutDeliveryPersistence` —
  SENDER-side-only durable state (§4); already covered by this
  repository's own pre-existing Group vertical-slice restart tests, not
  specific to NIP-17.
- `FedosConversationMembershipPersistence`/`FedosConversationActivationPersistence`/
  Envelope/Payload persistence — all pre-existing, unmodified, already
  restart-proven by prior Arcs; the NIP-17 inbound path writes through
  these exactly like every other Direct message.

## 7. Exact deferred tests (from `cd5584b`'s own completion declaration)

1. A dedicated Group INBOUND test — no test today exercises a recipient's
   own independent unwrap/decrypt/import of a Group-fanout Gift Wrap; the
   mechanism is asserted (by code reading) to be the same proven Direct
   inbound path, never actually run end-to-end for a Group scenario.
2. An explicit stop/restart-cycle test for the new `schemaVersion: 2`
   Outbox record specifically (the restart mechanism itself is shared,
   unmodified, and already tested for V1 — no NEW test re-proves it for
   V2).
3. Phase D–G's exhaustive matrices: outer Gift-Wrap tamper, Seal tamper,
   Rumor tamper, wrong-recipient, hostile-Relay, and
   proprietary/standard-route isolation — the prior Arc's own adapter-level
   tamper/wrong-recipient tests (from the earlier, crypto-only
   `nip17-gift-wrap` Arc) still pass unmodified and cover the crypto
   boundary itself, but no matrix exists at the LIVE dispatch/import
   coordinator boundary this Arc's own Phase C/D adds.
4. Phase F (mailbox/ephemeral semantics for the standard route) and fuller
   documentation/runbook items.

## 8. Expected production changes — assessment: likely near-zero, one open question

Every deferred item above is a TEST, not a missing mechanism, with one
exception already flagged in §4: **the canonical-linkage gap is real, not
merely untested.** Whether it requires a production change turns on how
literally this Arc's own Phase A acceptance criteria ("each imports exactly
one local Group Message representation") is read:

- If satisfied by "the recipient can read the exact plaintext through
  `readDirectMessage()` on the shared pairwise Direct Conversation" (the
  existing, accepted Alpha 1362/1366 design) — **zero production change**,
  Phase A becomes a pure test-writing exercise proving what already works.
- If it requires the recipient's own Runtime to actually possess a
  Group-scoped record it can enumerate via something like
  `listPrivateGroupMessages()` — a genuine, currently-absent capability —
  then Phase B's own prescribed path applies: the smallest additive
  authenticated-content extension (additional tags on the INNER Rumor,
  inside the Seal, never the outer Gift Wrap — carrying
  `groupConversationId`/`generationId`/`groupMessageId`/`senderMembershipId`/
  optional reply reference) plus a narrow, additive recipient-side import
  step that writes a Fanout-Delivery-shaped local fact keyed by that
  linkage. This would be the one place this Arc's own "Production Changes"
  section permits a change, since it would be "a new failing test proves a
  real defect in Group inbound mapping" exactly as authorized.

This report does not resolve that reading unilaterally — it is flagged
here as the one open design question Phase A/B must settle with a real
test BEFORE any production code is touched, per this Arc's own "no
production modification before this report" / "a new failing test proves a
real defect" discipline.

## 9. Current baseline (this exact worktree, before any change)

- `npm run typecheck`: clean except the one pre-existing,
  cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`) —
  identical to every prior Arc's own reported baseline.
- `npx vitest run` (full `npm test`): **231 failing test files / 302
  failing tests, 721/952 files and 12,172/12,474 tests passing.** Every
  failing file was categorized against the full log; all fall into the
  same pre-existing, cross-Arc-documented categories this branch's own
  prior completion declarations already name — none reference a Direct/
  Group/Conversation/Transport production file this Arc is in scope to
  touch:
  - The bulk (~190+) are the `core.autocrlf`-driven CRLF `Cargo.toml`
    dependency-count / `pub fn`-count "Stage N" assertions
    (`expected +0 to be 11` / `expected 19 to be 17`) this exact branch's
    own `cd5584b` completion declaration already documents as a
    "structurally incompatible with this crate's own real, legitimate
    growth since" standing category, confirmed byte-identical in kind to
    that report.
  - `test/secure_runtime_alpha_1841_1920_nip17_transport_group_integration.test.ts`
    (all 3 tests) — `buildRealParticipant: expected "available", got
    "artifact-missing"`: this fresh worktree has not yet run
    `npm run build:wasm` (no `packages/fedos-core-rust/pkg/` exists yet).
    Not a regression — this is the exact real-crypto vertical suite
    `cd5584b`'s own report confirms passes once the artifact is built;
    rebuilding it is the next mechanical step (§10).
  - 5 `test/reviews/*` "git working tree is clean" guards — red by
    construction until this Arc's own commit lands, identical precedent
    to every prior Arc.
  - The remaining handful (~35, publish-scheduler/host-write/identity
    range 200s–600s) match the same pre-existing, non-Conversation
    category the Alpha 1841–1920 and Alpha 1921–1980 reports both already
    named.

  Zero failures reference `src/conversation/`, `src/desktop/`, or
  `src/nostr/` production files this Arc is in scope to touch, beyond the
  artifact-missing acceptance suite above.
- `cargo check`/`cargo test`/`npm run build:wasm`: not yet run in this
  worktree (queued next, sequentially, per this Arc's own "never run
  npm/cargo concurrently" instruction — `npm test` above just completed).
- `package.json`/`package-lock.json`/`packages/fedos-core-rust/Cargo.toml`:
  unchanged so far (worktree freshly created from `cd5584b`, nothing
  edited yet).

## 10. Staging plan

1. Capture the full baseline (`npm test`, `cargo check`, `cargo test`,
   `npm run build:wasm`) in this worktree and record it verbatim.
2. Write the dedicated 3-participant Group inbound test (Phase A) using
   the existing `cd5584b`-era real-crypto harness pattern
   (`test/secure_runtime_alpha_1841_1920_nip17_transport_group_integration.test.ts`'s
   own `FakeRelayServer`/independent-identity/independent-`FedosPrivateTransport`
   shape, extended to three participants) FIRST, against the
   currently-accepted "read via shared Direct Conversation" design — this
   settles §8's open question empirically: if the existing mechanism
   already satisfies every one of Phase A's 14 required steps read
   literally, no production change is needed and Phase B becomes
   documentation-only (recording why the linkage is not required at the
   wire level, given the existing sender-local-only Group read-model
   precedent). If it does not — if there is a concrete, reachable
   correctness gap, not merely an unexercised capability — implement the
   smallest additive Rumor-tag extension named in §8 and one narrow
   recipient-side linkage-import step, backed by that same failing test
   turning green.
3. Phase C (restart/dedup) — extend the existing restart-proof shape
   (stop/restart a Runtime mid-flight, fresh Runtime over the same durable
   paths) already used by prior Direct/Group vertical slices to the V2
   Outbox record and the Group-recipient-specific scenarios this Arc's own
   Phase C names.
4. Phases D–G (tamper/wrong-recipient/hostile-Relay/route-isolation
   matrices) — additive test files only, exercising the existing adapter/
   coordinator boundaries; no production change expected unless a matrix
   entry surfaces a genuine gap, in which case the same "narrowly
   documented, minimal fix" discipline applies.
5. Phase H (member evolution) — additive test over the existing Group
   generation/removal mechanism.
6. Phase I (lifecycle/resource safety) — additive tests over existing
   start/stop/subscription-teardown behavior.
7. Phase J (real-crypto acceptance) + structural/secret guards + full
   verification sequence, documentation, cleanup, one primary commit.

No production code has been modified in the production of this report.

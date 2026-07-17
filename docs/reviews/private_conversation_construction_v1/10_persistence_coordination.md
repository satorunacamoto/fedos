# Review 10 — Persistence Coordination

## What construction spans

Up to five separate durable concerns, each its own append-only-backed
port, confirmed independent in `01`:

1. `FedosConversationPersistence` (Conversation record)
2. Policy — NOT separately persisted in V1 (`07`'s own finding: Policy
   Authority resolution stays static/derived, matching the existing
   `StaticFedosConversationPolicyAuthority` precedent; no
   `FedosConversationPolicy` record is ever written to its own log)
3. `FedosConversationMembershipPersistence` (creator Membership)
4. Encryption epoch metadata — per `08`, structurally absent from this
   checked-out tree; construction cannot write what does not exist,
   so this concern is skipped entirely under `09`'s Option B draft
   path, and blocks construction entirely under Option A
5. `FedosConversationCapabilityPersistence` (optional initial
   Capability, `11`)

## No transactionality across separate append-only logs

Restated as this review's own explicit, load-bearing constraint,
directly inherited from every append-only backend's own documented
behavior (`01`): `AppendOnlyFedosConversationPersistence`,
`AppendOnlyFedosConversationMembershipPersistence` (referenced via its
port), and `AppendOnlyFedosConversationCapabilityPersistence` are FOUR
INDEPENDENT FILES with no shared commit, no two-phase commit protocol,
and (per each file's own header) no delete/rewrite/rollback method of
any kind. A crash between writing #1 and writing #3 leaves a durable
Conversation record with no owner Membership — permanently, until a
recovery mechanism (below) repairs the OBSERVATION of that state, not
the state itself.

## The best available precedent: the Durable Redemption Coordinator

`FedosConversationDurableRedemptionCoordinator`
(`src/conversation/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts`)
is the single strongest existing precedent in this codebase for
EXACTLY this problem — coordinating a durable write across TWO
independent backends (Capability consumption + Membership admission)
with crash-window recovery, and its own header states the discipline
precisely: "no fake rollback... only ever moves FORWARD," recovering
by re-deriving a DETERMINISTIC coordination id
(`fedosConversationRedemptionCoordinationId(capabilityId, redeemer)`)
and reading a `FedosConversationRedemptionCoordinationPersistence`
fact log to learn how far a PRIOR attempt got.

## Narrow coordination record vs. deterministic recovery — compared

**Option 1 — a dedicated `FedosConversationConstructionCoordinationPersistence`
log**, mirroring `FedosConversationRedemptionCoordinationPersistence`
exactly: one phase-tagged fact per construction attempt
(`"conversation-recorded"` → `"membership-admitted"` →
`"capability-issued"` (if requested) → `"completed"`), keyed by a
deterministic `constructionId` derived from the Conversation id itself
(construction happens at most once per Conversation id, so no
redeemer-style disambiguation is needed — simpler than the redemption
coordinator's own three-part key).

**Option 2 — deterministic recovery with no dedicated log**, relying
purely on re-derived ids: recovery re-attempts step 1
(`putConversation` — idempotent, `"already-present"` on retry per
`fedosPersistedConversationRecordsAreEqual`), then step 2 (`admit()`
for the deterministic creator-Membership id — ALSO already idempotent,
per `06`'s own finding), then step 3 (`issueJoinCapability()` — NOT
naturally idempotent, since two separate `issueJoinCapability()` calls
mint two DIFFERENT `capabilityId`s with no deterministic derivation
today, unlike Conversation/Membership ids).

## Recommendation: Option 1, narrow coordination record — for one concrete reason Option 2 cannot address

Step 3 above (Capability issuance) is NOT idempotent under Option 2 —
`FedosConversationCapabilityIssueRequest` has no analog to
`toFedosConversationMembershipId()`'s deterministic derivation; a
retried "issue the initial join Capability" step after a crash would
mint a SECOND, orphaned Capability rather than recognizing the first
one already succeeded. This is the exact problem the Durable
Redemption Coordinator's own dedicated coordination log was built to
solve for the (structurally identical) Capability+Membership pairing
during REDEMPTION — construction faces the same problem one step
earlier, during ISSUANCE, and should reuse the identical pattern
rather than inventing a second one. A future Arc implementing
construction should add a
`FedosConversationConstructionCoordinationPersistence` port, mirroring
`FedosConversationRedemptionCoordinationPersistence`'s own shape
field-for-field, substituting construction's own phase vocabulary.

## Recoverable ordering

1. Write Conversation record (idempotent retry: `"already-present"`).
2. Write coordination fact `"conversation-recorded"`.
3. Admit creator Membership (idempotent retry, `06`).
4. Write coordination fact `"membership-admitted"`.
5. If `initialCapability` requested (`11`) AND not already recorded in
   the coordination fact as issued: issue it, write coordination fact
   `"capability-issued"` with the resulting `capabilityId` recorded ON
   the fact itself (so a retry reads the ALREADY-issued id rather than
   minting a second one — the coordination record becomes the source
   of idempotency Capability issuance itself lacks).
6. Write coordination fact `"completed"`.

This is `FedosBoardRuntime`'s own "write A first, then B, no atomicity
claimed" precedent (`#recordConversationForRootPost()`), extended by
one more concern and strengthened with the Redemption Coordinator's own
crash-recovery pattern where plain id-determinism (sufficient for
steps 1/3) is not enough (step 5).

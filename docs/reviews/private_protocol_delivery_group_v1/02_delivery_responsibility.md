# Review 02 — Delivery Responsibility Ordering

## The required ordering, grounded in code that already enforces an analogous ordering today

The task's own required sequence —

```
Authorized local private message -> protocol eligibility ->
protocol encoding/encryption mapping -> durable Outbox intent ->
protocol Publisher -> transport -> Observation
```

— is not a new invention this review proposes in the abstract; it is
the **same shape** `FedosBoardRuntime.#assembleAndSubmit`
(`src/board/runtime/fedos_board_runtime.ts:376-442`) already enforces
for public posts, confirmed by direct read: `evaluateFedosOutboundEligibility()`
runs **per target, before any Outbox intent is created**
(lines 395-398, 424), routing ineligible targets to a
`{target, result:"ineligible"}` record and never calling
`createFedosBoardOutboxIntent`/`submitPostWithOutbox` for them (only
`eligibleTargets`, line 436). This review's recommendation for private
delivery is to apply the identical discipline, substituting a private,
protocol-neutral eligibility gate (`09`) for the public
`evaluateFedosOutboundEligibility()`, and a private Outbox intent (`10`)
for `FedosBoardOutboxIntent`.

For the Conversation domain specifically, the first stage
("authorized local private message") already exists and is real:
`FedosConversationEncryptionCoordinator.encrypt()`
(`src/conversation/encryption/fedos_conversation_encryption_coordinator.ts:172-320`)
already performs membership/readiness/identity/key-resolution gating and
durably persists an Envelope + opaque ciphertext Payload before this
review's own scope begins. **This review's own ordering therefore starts
at the boundary immediately after a `FedosConversationMessageEnvelope`
already exists and is durably persisted** — it does not re-derive or
duplicate anything the Coordinator already does.

## Publisher must not decide Conversation privacy policy — already true today, must remain true

Confirmed directly: a grep for `privacy|policy|mode` across
`src/board/publish/**` (all files, including `src/board/publish/nostr/`)
returns no matches beyond retry-policy comments; a follow-up grep for
`isEligibleForPublicOutboundTarget|policy\.|federationEligibility` in
`src/board/publish/nostr/` returns zero matches. Every privacy/policy
decision for public posts is made exclusively in
`FedosBoardRuntime`/`evaluateFedosOutboundEligibility`, strictly before a
Publisher is ever invoked. This review's own requirement — "Publisher
must not decide Conversation privacy policy" — is not a new constraint
to design against; it is the **existing, board-domain precedent**, and
any future private-delivery Publisher must preserve the same boundary:
a Publisher receives an already-eligible, already-encrypted, already-
addressed delivery intent and reports transport outcome only. It must
never itself consult `FedosConversationMembership`, `FedosPrivateConversationPolicy`,
or lifecycle state to decide whether to attempt delivery.

## The full ordering, concretely, for a future private delivery Arc

```
1. FedosConversationEncryptionCoordinator.encrypt()            (EXISTS, real)
   -> durable Envelope + opaque Payload
2. Delivery Eligibility gate (09)                              (NOT YET BUILT)
   -> protocol-neutral: active Conversation, authorized sender
      Membership, supported mode, protocol capability, recipient
      mapping, encryption/wire readiness, explicit destination
3. Wire-mapping decision per protocol (03/04/06/07/08)          (NOT YET BUILT)
   -> per-protocol encode/encrypt-for-wire (Option B where a
      protocol-native encrypted representation exists)
4. Private Outbox intent, durable, by-reference only (10)      (NOT YET BUILT)
5. Protocol Publisher — transport attempt only, no policy (11) (partially exists for Nostr, public-only)
6. Transport (the real send/subscribe path)                    (real for Nostr public posts only)
7. Observation (accepted/rejected/transient-failed/etc, 11/12)  (reusable AS-IS, 10)
```

Step 1 is the only step that exists today for the Conversation domain.
Steps 2–6 do not exist for private delivery of any protocol; `04`–`08`
inventory exactly how far each protocol's existing (public-post-shaped)
machinery could be adapted toward step 5/6, and where it categorically
cannot (Sessions/ActivityPub/ATProto outbound Publishers do not exist at
all).

## See also

- `01_source_inventory.md`
- `09_delivery_eligibility.md`, `10_outbox_intent.md`, `11_delivery_results.md`
- `docs/reviews/private_conversation_construction_v1/18_protocol_delivery.md`
  (construction's own, still-valid "never imports `src/board/publish/`"
  boundary — this review extends it, does not relax it)

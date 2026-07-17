# Review 09 — Delivery Eligibility

## Protocol-neutral inputs, modeled directly on two already-real gates

This review does not invent an eligibility model from scratch — it
composes the **already-real** fail-closed gates
`FedosConversationEncryptionCoordinator.encrypt()`
(`src/conversation/encryption/fedos_conversation_encryption_coordinator.ts:172-320`)
already enforces with the **already-real** ordering
`evaluateFedosOutboundEligibility()`
(`src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts:61-103`)
already enforces for public posts. The seven protocol-neutral inputs
the task names map onto concrete, already-checked facts as follows:

| Input | Concrete check today | Where |
|---|---|---|
| Active Conversation | `persistedDraft.lifecycleState !== "active"` -> `"conversation-not-active"` | `fedos_conversation_encryption_coordinator.ts:203` — **always fails today**, see `01`. |
| Authorized sender Membership | `identityResolver.resolveLocalParticipant()` + `evaluateFedosConversationCryptoReadiness()`'s own `membershipAuthority.findMembership(...).state === "active"` check | `fedos_conversation_membership_readiness.ts:71` |
| Supported mode | `MembershipFedosConversationParticipantResolver.resolveCounterparty()` requires exactly one other active member | `fedos_conversation_participant_resolver.ts:62-78` — private-group (>1 other member) fails closed to `"ambiguous-counterparty"`, not merely "not yet supported" |
| Protocol capability | None ready for any protocol — `FedosConversationEncryptionReadinessAuthority`'s default implementation always returns `{state:"unavailable"}` | `fedos_conversation_encryption_readiness_authority.ts:55-61` |
| Recipient mapping | `resolveFedosConversationCounterpartyPublicKeyHex()` — resolves only `authority === "nostr"` counterparties | `fedos_conversation_counterparty_public_key_resolver.ts:48` |
| Encryption/wire readiness | Same readiness axis as above, plus `04`'s finding that no NIP-44/gift-wrap wire mapping exists | `09` (this doc), `04` |
| Explicit destination | Not built for private delivery; the public-post precedent (`evaluateFedosOutboundEligibility`) never infers a destination automatically | `fedos_outbound_eligibility_types.ts:31-46` (target is caller-supplied, never inferred) |

## No automatic fanout, no inbound-provenance target inference — already the public-post precedent, must carry over unchanged

Confirmed: `FedosOutboundEligibilityInput`
(`src/board/runtime/eligibility/fedos_outbound_eligibility_types.ts:31-46`)
takes `target: FedosBoardOutboxTarget` as a caller-supplied value; the
evaluator never derives a target from an inbound event's own provenance
or from "every protocol the account happens to be bound to." A future
private-delivery eligibility gate must preserve this exactly: a message
is eligible for delivery to **the recipient(s) the Conversation's own
Membership records name**, over **the protocol(s) the sender explicitly
selects for that send** — never "every protocol every member happens to
support," and never inferred from where a prior message in the thread
arrived from.

## The exact, fixed order this review recommends (not a new order — the one `02` already derives)

1. Active Conversation (today: never true)
2. Authorized sender Membership
3. Supported mode (today: `direct` only — reachable; `private-group`
   structurally rejected by the participant resolver, `01`)
4. Explicit destination (protocol + recipient, caller-supplied)
5. Protocol capability for that destination (today: none ready)
6. Recipient mapping resolves for that protocol (today: Nostr only)
7. Encryption/wire readiness for that protocol (today: none ready)

Steps 1–3 already exist as real code (via the Coordinators); steps
4–7 do not exist for private delivery of any kind and are this
review's own recommended shape for a future eligibility gate, not a
claim that one is built.

## See also

- `01_source_inventory.md`, `02_delivery_responsibility.md`
- `10_outbox_intent.md`
- `docs/reviews/private_conversation_construction_v1/18_protocol_delivery.md`

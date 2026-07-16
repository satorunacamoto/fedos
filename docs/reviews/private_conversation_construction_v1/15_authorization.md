# Review 15 — Private Read/Write Authorization

## The consultation chain future message operations must follow

This review's own scope is construction, not message send/read
authorization — but per this review's own required content, the chain
a FUTURE message operation must consult is specified here so
construction's own outputs (Conversation record, Policy, Membership,
readiness state) are shaped to support it correctly, without this
review designing the message-send command itself (that belongs to the
sibling `private_message_envelope_v1` scope, not read or depended on
here per this review's own instruction).

```
1. Policy   -- FedosConversationPolicyAuthority.resolvePolicy(conversationId)
               -> writeAccess / readAccess axis (07)
2. Membership -- FedosConversationMembershipAuthority.findMembership(conversationId, actor)
               -> must be state: "active" (never "revoked"/"left"/absent)
3. Encryption readiness -- 08's live gate, re-evaluated (never cached from construction)
4. Envelope/Storage -- FedosConversationPayloadStorage / FedosPayloadRetentionAuthority
               -> evaluatePayloadAccess() before any read; putPayload() only after 1-3 pass
```

Each step is a SEPARATE, already-real (or, for step 3's LIVE
re-check, already-specified in `08`) authority — no step is skipped,
and EVERY step must pass independently. This directly extends the
precedent `FedosPayloadRetentionAuthority.readPayload()` already
establishes ("retention state is checked BEFORE
`payloadStorage.getPayload()` is ever called," `01`) one layer
further back, adding Policy and Membership ahead of the Retention/
Storage check that file already performs.

## What this chain explicitly does NOT authorize on

Per this review's own required prohibition, restated as an ENFORCED
absence, not merely an omission:

- **Display pseudonym** — `FedosConversationParticipantReference` (the
  ONLY identity type Membership/Capability ever key on) has no
  `displayName` field at all (`01`'s own field-by-field confirmation);
  there is nothing for a hypothetical "authorize by pseudonym" check
  to even read.
- **Invite URL** — no URL type exists anywhere in
  `src/conversation/capability/` (`01`); a bearer secret is an opaque
  branded string, never a URL, and is consumed exactly once through
  `redeem()`/the Durable Redemption Coordinator, never re-used as a
  standing credential for ongoing read/write authorization.
- **Protocol identifier alone** — `FedosConversationParticipantReference.publicIdentifier`
  is scoped to its own `authority` field (`"fedos" | "nostr" |
  "activitypub" | "atproto" | "session" | "temporary-capability"`);
  the type's own header states explicitly "two references with the
  same `publicIdentifier` but different `authority` are NEVER treated
  as the same participant anywhere in this Arc" — step 2 above
  therefore MUST compare the full `(authority, publicIdentifier)`
  pair, never `publicIdentifier` in isolation, matching
  `toFedosConversationMembershipId()`'s own three-part key exactly.

## Why this belongs in a construction review at all

Construction (`04`–`06`) is what PRODUCES the Policy record, the owner
Membership, and the readiness snapshot this chain consults at step
1/2/3. A construction implementation that skipped writing a resolvable
Policy, or that admitted a creator Membership without recording the
correct `(authority, publicIdentifier)` pair, would silently break
this authorization chain downstream — this review names the chain so
`04`–`06`'s own outputs can be verified against it directly (and are,
in `test/reviews/private_conversation_construction_v1/readiness_invariants.test.ts`).

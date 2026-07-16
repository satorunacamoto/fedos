# Secure Runtime Alpha 746 — Policy Reference Decision

Stage 6. Compares, for `FedosConversationRecord.policyReference`:

**A. full immutable policy embedded.** Rejected — would duplicate
`FedosConversationPolicy` into every record; Alpha 654 (Policy Arc)
already decided policy is not embedded per-post/per-record for exactly
this reason (a changing policy value duplicated into an immutable
record would go stale).

**B. policy ID/reference.** The general shape adopted, in its smallest
honest form — see D below for the exact representation.

**C. no policy field at all.** Rejected — a record with no trace of
which policy generation governed it at creation time cannot be
reconciled later if a second policy value is ever introduced (e.g. a
future `"public-v2"` with different discoverability defaults);
omitting it now would make that future reconciliation retroactively
impossible for every V1-era record.

**D. policy version/hash.** ADOPTED, as a fixed string-literal TAG
(`"public-v1"`), not a hash:

```ts
export type FedosConversationPolicyReference = "public-v1";
```

`FedosConversationPolicyAuthority` today
(`StaticFedosConversationPolicyAuthority`, Policy Arc Alpha 656) is
itself RUNTIME-STATIC — every V1 Conversation shares the exact same
`FEDOS_CONVERSATION_POLICY_PUBLIC_V1` value, never persisted, never
versioned beyond this one fixed value (Alpha 654's own "no unnecessary
persistence for V1" decision). A content hash would claim a precision
("this exact policy content, byte for byte, at creation time") this Arc
cannot honestly back with any persisted policy history — there is
nothing to hash against except the one compile-time constant every
record already implicitly references. A literal tag names the fixed
policy GENERATION a record was created under, nothing more, and costs
nothing to verify.

## Persistence and versioning authority

Ownership of what `"public-v1"` resolves to belongs entirely to
`FedosConversationPolicyAuthority`, never to the Conversation record
itself — the record carries the tag, not the policy's field values.
When a second real policy value is eventually needed (per-conversation
divergence, or a future policy schema change), the migration is
additive: a new tag (e.g. `"public-v2"`) is introduced without
rewriting existing `"public-v1"`-tagged records, exactly as the
approved Conversation Foundation V1 review's own `05_policy_reuse.md`
already specified. This Arc makes no persisted-policy-history claim
anywhere — asserted explicitly here, not merely implied by omission.

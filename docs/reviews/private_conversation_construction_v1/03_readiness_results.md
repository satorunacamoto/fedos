# Review 03 — Readiness Result Vocabulary

A closed result type for "may this system construct a private
Conversation right now" — mirrors every other Authority's own "closed
outcome union, never a raw `Error`, never an arbitrary metadata bag"
discipline already established across this codebase
(`FedosConversationPolicyResolution`,
`FedosConversationCapabilityRedemptionResult`,
`FedosPayloadRetentionResult`, all read directly in `01`).

```ts
export type FedosConversationConstructionReadiness =
  | { readonly outcome: "ready" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "membership-unavailable" }
  | { readonly outcome: "capability-unavailable" }
  | { readonly outcome: "encryption-unavailable" }
  | { readonly outcome: "storage-unavailable" }
  | { readonly outcome: "unsupported-mode" }
  | { readonly outcome: "policy-invalid" }
  | { readonly outcome: "runtime-unavailable" };
```

No `Error` object, no free-form `reason` string, no arbitrary metadata
field — matching the closed-vocabulary discipline `FedosConversationCapabilityRedemptionResult`
already established ("Coarse, stable reasons only... a caller can
never distinguish [more] than this result alone" —
`src/conversation/capability/fedos_conversation_capability_redemption_result.ts`).

## Mapping from `02`'s nine axes to this vocabulary

Nine independent axes deliberately collapse to a smaller, closed
OUTCOME vocabulary for the caller-facing readiness check — a caller
constructing a Conversation does not need to distinguish "axis 7 failed"
from "axis 8 failed" (both are storage-domain problems the SAME retry
action would address), but does need to distinguish "no identity" from
"no encryption" (different remediation entirely):

| Axis (`02`) | Result outcome when the axis fails |
|---|---|
| 1. Conversation metadata persistence | `"runtime-unavailable"` (a port failure) or `"unsupported-mode"` (the validator itself rejects the mode) |
| 2. Creator identity | `"identity-unavailable"` |
| 3. Creator Membership | `"membership-unavailable"` |
| 4. Policy | `"policy-invalid"` |
| 5. Capability authority | `"capability-unavailable"` |
| 6. Encryption authority | `"encryption-unavailable"` |
| 7. Payload storage | `"storage-unavailable"` |
| 8. Retention contract | `"storage-unavailable"` |
| 9. Protocol delivery support | never a readiness-check failure — see `02`'s own "explicitly not a construction blocker"; surfaced only in the constructed record's own observable state (`13`), never blocks readiness |

`"unsupported-mode"` is doing double duty deliberately, mirroring
`FedosConversationPolicyResolution`'s own existing `"unsupported-mode"`
value (`src/board/runtime/policy/fedos_conversation_policy_authority.ts`)
— it is the SAME token this codebase already uses for "this Authority
could resolve some inputs but not this specific mode," reused here
rather than inventing a rhyming second name.

## Why `"ready"` is a single value, not itself a record

`FedosConversationConstructionReadiness` answers ONLY "may construction
proceed" — it deliberately carries no policy value, no resolved
identity, no draft record. A readiness CHECK is a preview
(`previewAdmission()`'s own "pure — never mutates" precedent,
`src/conversation/membership/fedos_conversation_membership_authority.ts`);
the actual construction call (`04`/`05`) performs the real resolution
and returns ITS OWN result vocabulary, separately. Folding the resolved
values into the readiness result would let a caller mistake a stale
preview for a fresh guarantee — the same reasoning `FedosConversationMembershipAuthority`
already applies by keeping `previewAdmission()` and `admit()` as two
separate calls with two separate result types.

## Why no `"already-exists"` value

Deliberately absent. "A Conversation with this id already exists" is
not a READINESS fact about the SYSTEM (identity/membership/capability/
encryption/storage authorities are unaffected by it) — it is an
ATOMICITY/CONFLICT fact about one specific construction attempt,
already covered by `10`'s own persistence-coordination result
vocabulary and `14`'s Failure Matrix, mirroring
`FedosConversationPersistenceWriteResult`'s own separate
`"already-present"`/`"conflict"` tokens rather than folding them into
a readiness pre-check. A caller MUST be able to ask "is this system
capable of constructing ANY private Conversation right now" without
first knowing a candidate id.

## Total, never throws

Every producer of this type (a future `FedosConversationConstructionReadinessAuthority`,
not implemented by this review) must be total and never throw — mirrors
`FedosConversationPolicyAuthority.resolvePolicy()`'s own `Promise`-returning,
non-throwing contract and every other Authority read in `01`. A caller
receiving `{ outcome: "runtime-unavailable" }` learns exactly as much
as, and no more than, `FedosBoardRuntime.createPublicThread()`'s own
existing `{ outcome: "unavailable" }` case when `host.desktop() ===
null` — the same fail-closed idiom, extended to nine axes instead of
one Host-readiness check.

# Secure Runtime Alpha 7481–7560 — Export/Restore Parity Specification

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

## Export parity (`collectFedosConversationArchiveBundle()`)

```ts
const envelopes = deps.envelopePersistence
  .listConversationEnvelopes(conversationId)
  .filter((envelope) => deps.retentionAuthority === undefined || isPayloadPermitted(deps.retentionAuthority, envelope.payloadId));

const payloadDescriptors = deps.payloadStorage.listConversationPayloads(conversationId);
const payloads = payloadDescriptors
  .filter((descriptor) => deps.retentionAuthority === undefined || isPayloadPermitted(deps.retentionAuthority, descriptor.id))
  ...
```

Both filters call the SAME `isPayloadPermitted()` helper, over the SAME
`retentionAuthority.evaluatePayloadAccess()` gate, keyed by the SAME
concept (a `payloadId`) — one denial excludes both records. Never an
independent, disagreeing decision.

**Guarantees:**
- Deterministic: the same conversation state, evaluated twice, produces
  the identical bundle.
- Bounded: no new unbounded loop — the SAME O(N) list-then-filter shape
  as the pre-existing Payload filter.
- Stable ordering: `.filter()` preserves the underlying persistence
  port's own iteration order, exactly as `listConversationEnvelopes()`
  already did before this Arc.
- No arbitrary caller override: `retentionAuthority` is either the SAME
  real `FedosPayloadRetentionAuthority` a caller already had, or
  omitted; there is no path for a caller to selectively exempt one
  Envelope while still gating its Payload, or vice versa.
- Duplicate handling: unaffected — this filter runs BEFORE any
  duplicate-detection or write logic ever sees the bundle.

## Restore parity (`restoreFedosConversationArchiveBundle()`)

```ts
if (deps.retentionAuthority !== undefined && !isPayloadPermittedForRestore(deps.retentionAuthority, runtime.payloadId)) {
  tally(envelopeCounts, "denied");
  continue;
}
...
if (deps.retentionAuthority !== undefined && !isPayloadPermittedForRestore(deps.retentionAuthority, decoded.descriptor.id)) {
  tally(payloadCounts, "denied");
  continue;
}
```

`isPayloadPermittedForRestore()` differs from the export-side
`isPayloadPermitted()` in exactly one respect: it ALSO permits
`{outcome:"not-found"}` (this restoring device has no record of the
Payload at all), never just `{outcome:"allowed"}` — the deliberate,
documented asymmetry that makes foreign/new-profile restore behave
honestly (see the Retained-Copy/Non-Guarantee document).

**Guarantees:**
- Never grants access an Archive itself claims but the CURRENT device's
  own live Retention Authority denies — "Archive-carried deletion/
  tombstone facts cannot grant access" is satisfied structurally: the
  Archive's own bundle content is never consulted for this decision, only
  the restoring device's OWN authority.
- Missing/corrupt policy state fails closed: `isPayloadPermittedForRestore()`'s
  own `try/catch` treats a thrown Authority identically to `"denied"`.
- Idempotent: restoring the identical bundle twice denies the identical
  records both times (the gate is a pure function of current device
  state, not of what happened on a prior restore attempt).
- Conflicting duplicate: unaffected — the existing
  `"duplicate"`/`"conflict"` write-result vocabulary is checked only
  AFTER this gate permits a record through; a denied record never
  reaches `put*()` at all, so it can never itself become a "conflict."
- Rollback/replay: a restore interrupted mid-way and retried behaves
  identically on retry — the gate is stateless per call, and `put*()`'s
  own pre-existing idempotent semantics are unchanged.

## Rollup (`FedosConversationArchiveRuntime.restoreConversationArchive()`)

Priority order, unchanged in principle, extended with one new tier:

```
failed > conflict > invalid > denied > (else: inserted ? "restored" : "already-present")
```

`"partially-denied"` is reported distinctly from `"partially-invalid"` —
the caller can tell "some content was intentionally, correctly
suppressed by policy" apart from "some content was corrupt/malformed."

## Never an authority that overrides live Retention

At no point does this Arc's own Archive-layer code WRITE a retention
decision, only READ one (via the same pure-preview
`evaluatePayloadAccess()` every other caller already uses). Archive
remains strictly downstream of Retention, never upstream of it, and
never a second source of truth.

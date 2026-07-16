# Secure Runtime Alpha 694 — Eligibility Evaluator Integration

Stage 14 of Phase A. Closes the Alpha 649/665 blocker.

`FedosOutboundEligibilityInput`
(`src/board/runtime/eligibility/fedos_outbound_eligibility_types.ts`)
gains one new optional field, `nostrAuthorBinding?: FedosNostrAuthorBindingResult`.
`evaluateFedosOutboundEligibility()`'s nostr branch
(`src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts`)
becomes:

```ts
if (input.target.protocol === "nostr") {
  if (input.nostrAuthorBinding?.outcome === "bound") {
    return { outcome: "eligible" };
  }
  return { outcome: "ineligible", reason: "identity-not-controlled" };
}
```

No new eligibility reason token is introduced — every non-`"bound"`
outcome (including `undefined`, when no Binding Authority is configured at
all) keeps the exact same `"identity-not-controlled"` reason this
evaluator has always produced. `FedosBoardRuntime` computes the binding
result once per command (Alpha 698), never inside this evaluator itself,
which stays synchronous and pure.

`test/secure_runtime_alpha_665_nostr_eligibility_evaluator.test.ts`'s own
test 1 remains valid and byte-for-byte unchanged — it never supplies
`nostrAuthorBinding`, so it still observes the identical fail-closed
default.

Verified in
`test/secure_runtime_alpha_694_eligibility_binding_integration.test.ts` (5
tests): bound unlocks eligibility; every non-bound outcome keeps
`identity-not-controlled`; omission preserves the pre-Arc default; a bound
result never unlocks non-nostr protocols; a bound result never overrides
an earlier fail-closed policy check (`conversation-local-only`).

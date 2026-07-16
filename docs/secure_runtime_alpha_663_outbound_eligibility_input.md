# Secure Runtime Alpha 663 — Outbound Eligibility Input

Stage 3. `FedosOutboundEligibilityInput`
(`src/board/runtime/eligibility/fedos_outbound_eligibility_types.ts`):

```ts
export interface FedosOutboundEligibilityInput {
  readonly policy: FedosConversationPolicy;
  readonly target: FedosBoardOutboxTarget;
  readonly authorResolution: FedosPublicAuthorResolution;
}
```

Adjusted from the Arc's own candidate shape by DROPPING the `post:
FedosBoardPost` field — continuing Alpha 633's own prior file's
identical discipline ("this file takes NO `FedosBoardPost` parameter at
all"), since no eligibility decision anywhere in this Arc has ever
needed a post's own body/timestamp/`source`, and keeping the field out
entirely removes any FUTURE temptation to read `post.source` for target
inference (which Alpha 668 forbids) by construction, not merely by
convention. `authorResolution` (not a bare `author`) is used instead of
also duplicating a separate `author` field, since
`FedosPublicAuthorResolution` already carries the author when one
exists, and the evaluator needs the FULL resolution (including
`"anonymous-local"`/`"unavailable"`/`"conflict"`) to reject correctly.

No signer object, no Relay, no secret, no retry data, no Observation
history anywhere in this type or its evaluator.

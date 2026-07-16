# Secure Runtime Alpha 722 — Canonical Delivery Result Decision

Stage 2. Options compared: A (`accepted | rejected | failed`), B
(`accepted | permanently-rejected | transient-failure`), C (`sent |
relay-accepted | relay-rejected | failed`), D (keep boolean + side
channel, rejected per instruction).

## Decision: reuse the existing shape — no new type created

`FedosOutboundPublishResult` (`src/board/publish/fedos_outbound_publish_result.ts`,
Alpha 492) **already is** Option A, verbatim:

```ts
export type FedosOutboundPublishResult =
  | { readonly outcome: "accepted"; readonly externalReference: string }
  | { readonly outcome: "rejected"; readonly externalReference: string | null }
  | { readonly outcome: "failed"; readonly externalReference: string | null };
```

Per the task's own explicit instruction ("If this shape already exists,
reuse it rather than creating another type"), NO new canonical result
type is introduced this Arc. `"rejected"` is already documented as
terminal by design — `outboundPublishOutcomeToRetryPolicy()` (Alpha 497)
already maps it to `retryPolicy: "never"`.

This Arc's own work is entirely about making the Nostr publish path
capable of actually PRODUCING this already-correct type's `"rejected"`
variant (Alpha 723/724), not about redesigning the type itself.

# Commerce State Machines — As-Implemented

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`.

> None of the diagrams below represent a live, running state machine — they represent the *set of string-literal values* a type can hold, since **no explicit transition function/table exists for any of Product, Order, Payment, or Delivery** in this codebase. Where a diagram implies a transition, it is drawn only where a caller *could* legally construct that new value — never because a guarded transition function was found. This is stated per-diagram below.

## Product

**Implicit only.** `ProductStatus = "draft" | "active" | "archived"` (`catalog/types.ts:23`) is a plain string-literal enum. No function named anything like `transitionProduct`/`activateProduct`/`archiveProduct` exists anywhere in `src/os/commerce/`. A status change, if it ever happened, would require a caller to construct an entirely new `Product` object with a different `status` — there is no guarded mutation.

```mermaid
stateDiagram-v2
    [*] --> draft: productFromSpace()/productFromEvent()<br/>(construction only, catalog/bridge.ts)
    draft --> active: no transition function exists —<br/>would require caller to build a new object
    active --> archived: no transition function exists
    draft --> archived: no transition function exists
    note right of draft
      No code path in this repo
      ever performs these transitions.
      Values shown are the enum's
      literal members only.
    end note
```

## Order

**Absent — no state machine, because no Order type exists at all.** `src/os/commerce/README.md:52-58` states explicitly: *"No Order... concept is defined anywhere in this capability."* There is nothing to diagram.

## Payment

**Implicit only.** `PaymentStatus = "unavailable" | "pending" | "accepted_placeholder" | "rejected" | "expired" | "refunded" | "error"` (`payment/types.ts:57-64`). `PlaceholderPaymentProvider`'s in-memory ledger (`noop_payment.ts:191`) mutates `entry.status` directly inside `observePayment`/`ingestCallback`/`cancelPayment`/`refundPayment`, with **no guard checking the entry's prior state** before mutating (e.g. `cancelPayment` doesn't verify the entry isn't already `refunded`; `refundPayment` doesn't verify it was ever settled).

```mermaid
stateDiagram-v2
    [*] --> unavailable: NoopPaymentProvider.requestPayment()<br/>(always, unconditionally)
    [*] --> accepted_placeholder: PlaceholderPaymentProvider.requestPayment()<br/>if amount>=0 and no sensitive metadata
    [*] --> rejected: PlaceholderPaymentProvider.requestPayment()<br/>if amount invalid or sensitive metadata present
    accepted_placeholder --> refunded: refundPayment()<br/>(NO check that entry was ever settled)
    accepted_placeholder --> rejected: cancelPayment()<br/>(NO check entry isn't already refunded)
    accepted_placeholder --> expired: observePayment()<br/>if now > expiresAt
    accepted_placeholder --> accepted_placeholder: ingestCallback({event:"settled"})<br/>UNAUTHENTICATED — no signature/HMAC check in this file
    note right of accepted_placeholder
      "paid" is NOT a member of this enum.
      accepted_placeholder explicitly means
      "passed a local policy check", never
      "money was received" (types.ts:22-24).
    end note
```

## Delivery

**Absent — no Delivery concept exists anywhere in the repository.** Confirmed by the same README statement cited above, and independently: `DigitalAsset` (the closest artifact-delivery shape) has zero consumers repo-wide (dead code). There is nothing to diagram.

## Summary

| Machine | Explicit transition function? | Verdict |
|---|---|---|
| Product | No | IMPLICIT (bare enum field only) |
| Order | N/A | ABSENT (type doesn't exist) |
| Payment | No — ad hoc, unguarded ledger mutation | IMPLICIT, and unguarded even within its own dormant scope |
| Delivery | N/A | ABSENT (type doesn't exist) |

**STATE MACHINES: PARTIAL** — Product and Payment have implicit state via bare fields; Order and Delivery are entirely absent as concepts.

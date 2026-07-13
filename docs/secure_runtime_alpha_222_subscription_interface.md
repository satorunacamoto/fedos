# Secure Runtime Alpha 222 — FedosSubscription Interface

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_subscription.ts`. This is Stage 2 of the Alpha
221–230 Nostr Subscription Foundation Arc, following Alpha 221's own
decision to build a new, minimal, Desktop-owned Subscription boundary.**

## 1. Why now

Alpha 221 §4 decided `FedosSubscription` would be the FIRST new type
this Arc builds — an opaque identifier-only handle, mirroring
`FedosRelay`'s own original "one field, nothing else yet" shape (Alpha
212 §2). This Stage builds exactly that, before any Filter (Alpha 223),
message builder (Alpha 224/225), or lifecycle method (Alpha 226)
depends on it.

## 2. What was implemented

```ts
export interface FedosSubscription {
  readonly id: string;
}
```

A single `readonly id: string` field — no filter, no relay reference,
no callback, no lifecycle state of any kind. A `FedosSubscription`
value is a plain, inert token: a caller receives one from
`subscribe()` (Alpha 226) and later hands it back to `unsubscribe()`
(Alpha 226) — it carries no information the caller can act on beyond
"this is the handle I was given."

## 3. Why "opaque identifier only" — matching this Arc's own Alpha 222
   instruction precisely

This Arc's own Alpha 222 instruction states plainly: "Introduce a
FedosSubscription interface. Opaque identifier only." Two design
choices honor that exactly:

- **No filter field.** A `FedosSubscription` does NOT carry the
  filters it was opened with — those live only in the `subscribe()`
  call's own argument list (Alpha 226). Carrying them on the handle
  would let a caller inspect or mutate a subscription's own filter set
  after the fact, a capability this Arc's own Goals list never asks
  for.
- **No relay reference.** A `FedosSubscription` does NOT carry a back-
  reference to the `FedosRelay` that created it. `unsubscribe()` is a
  method ON the relay (`relay.unsubscribe(subscription)`), not on the
  subscription itself (`subscription.close()`) — mirroring
  `FedosRelay.disconnect()`'s own shape (a method on the owning object,
  not on a handle) rather than inventing a second lifecycle-owning
  type.

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_subscription.ts` exports exactly one symbol,
  `FedosSubscription`.
- `FedosSubscription`'s own field count: exactly 1 (`id`).
- Zero method, zero optional field, zero union member exists on this
  type.
- Zero import exists in this file — `FedosSubscription` depends on
  nothing, matching `FedosRelay`'s own original zero-import shape
  (Alpha 212).

## 5. What this Stage does NOT do

- Does **not** implement `FedosSubscriptionFilter` — Alpha 223's own
  deliverable.
- Does **not** implement `buildReqMessage`/`buildCloseMessage` — Alpha
  224/225's own deliverables.
- Does **not** add `subscribe()`/`unsubscribe()` to `FedosRelay` — Alpha
  226's own deliverable.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `create_runtime.ts`, `types.ts`,
  `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_221_subscription_code_review.md`
- `docs/secure_runtime_alpha_212_relay_interface.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`

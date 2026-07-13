# Secure Runtime Alpha 229 — Subscription Future Extensibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 9 of the Alpha 221–230 Nostr Subscription Foundation Arc,
following Alpha 228's own Subscription Boundary Review.**

## 1. Why now

This Arc's own Alpha 229 instruction states plainly: "Future
extensibility. Confirm compatibility with Relay Pool." Relay Pool is
explicitly OUT of THIS Arc's own scope (its own "Do NOT implement"
list), but a Subscription Foundation that could not later support it
would be a foundation built on the wrong shape. This Stage reviews the
CURRENT `FedosRelay`/`FedosSubscription`/`FedosSubscriptionFilter`
shape against a hypothetical Relay Pool, the SAME kind of
forward-compatibility check Alpha 219 already ran for the Relay
Foundation, one Arc ago, before Subscription itself existed.

## 2. Relay Pool — compatible, composes OVER `FedosRelay`, never inside
   it

Alpha 219 §2 (Relay Foundation Arc) already established that a future
`RelayPool` would hold a COLLECTION of `FedosRelay` VALUES (e.g.
`Map<string, FedosRelay>`, keyed by `url`), fanning `connect()`/
`disconnect()`/`publish()` calls out to each member. This Arc's own
`subscribe()`/`unsubscribe()` additions fit the SAME shape with zero
extra accommodation needed:

- Each `FedosRelay` member of a future Pool already owns its OWN
  independent subscription lifecycle — `WebSocketRelay`'s own
  `#subscriptionCounter` (Alpha 226) is a PER-INSTANCE field, so two
  relays in a Pool generate their own independent `fedos-sub-${n}` id
  sequences with no cross-relay coordination required or assumed.
- A Pool-level `subscribe()` (if one were ever added) would fan a
  SINGLE logical subscription request out to N member relays, each
  returning its OWN `FedosSubscription` handle — the Pool would need
  to hold a `Map<string, FedosSubscription>` (relay url → that relay's
  own subscription handle) internally, exactly the SAME "hold N child
  values, aggregate calls" shape Alpha 219 §2 already described for
  `publish()`/`connect()`.
- `FedosSubscription`'s own "opaque identifier only" shape (Alpha 222)
  is what makes this composition trivial: a Pool never needs to
  interpret or merge subscription ids across relays — it only needs to
  hold onto whichever ones each member relay returned, and hand each
  back to the SAME relay's own `unsubscribe()` later.

## 3. Why `FedosSubscriptionFilter` needs no Pool-awareness

A future Pool's `subscribe()` would pass the SAME
`readonly FedosSubscriptionFilter[]` to every member relay unchanged —
filters are a REQUEST-shape concept, not a per-relay one.
`FedosSubscriptionFilter` (Alpha 223) has zero relay reference of any
kind, so it composes into a multi-relay call with no adaptation
required, the SAME reason `FedosEventDescriptor` (Alpha 202) already
composes into `publish()` calls fanned across multiple relays without
needing a relay-aware variant.

## 4. What does NOT generalize automatically — confirmed, not assumed

A future Pool aggregating `subscribe()` across multiple relays would
need to decide its OWN policy for partial failure (e.g. 2 of 3 member
relays accept the REQ, one rejects because it is disconnected) — that
policy is NOT implied by anything in this Arc's own `FedosRelay.
subscribe()` contract (which only ever describes ONE relay's own
all-or-nothing throw-if-disconnected behavior, Alpha 226 §3). This
mirrors Alpha 219 §6's own finding one Arc ago: `publish()`'s own
"transport only" contract does not automatically generalize to a
multi-relay context either — a future Pool Stage's own review would
need to decide that policy explicitly, the SAME "don't assume, review"
discipline applied again here.

## 5. Structural confirmation (real inspection, this Stage)

- `FedosRelay`'s own six methods (`connect`/`disconnect`/
  `isConnected`/`publish`/`subscribe`/`unsubscribe`) plus `url`:
  unchanged since Alpha 226, reconfirmed here.
- Zero reference to `Pool`, `RelayPool`, or a `Map<string, FedosRelay>`
  of any kind exists anywhere in `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `fedos_subscription.ts`,
  `fedos_subscription_filter.ts`, or `subscription_messages.ts`'s own
  CODE (doc-comment mentions discussing this as a forbidden guardrail,
  or as this Stage's own review topic, are expected and excluded from
  this check).
- `WebSocketRelay`'s own `#subscriptionCounter` (Alpha 226): confirmed
  a PRIVATE, PER-INSTANCE field — no static/module-level counter of
  any kind exists that could leak state across two independently
  constructed `WebSocketRelay` values.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a `RelayPool` or any multi-relay aggregation type of
  any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_228_subscription_boundary_review.md`
- `docs/secure_runtime_alpha_226_subscription_lifecycle.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`

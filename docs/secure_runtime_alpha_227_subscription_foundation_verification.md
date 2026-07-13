# Secure Runtime Alpha 227 — Subscription Foundation Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage only
(`test/secure_runtime_alpha_227_subscription_foundation_verification.test.ts`)
but makes NO production-code change of any kind. This is Stage 7 of
the Alpha 221–230 Nostr Subscription Foundation Arc, following Alpha
226's own Subscription Lifecycle — the closing implementation Stage.**

## 1. Why now

Alpha 222–226 built `FedosSubscription`/`FedosSubscriptionFilter`/
`buildReqMessage`/`buildCloseMessage`/`subscribe`/`unsubscribe`
incrementally; each Stage's own test suite verified its OWN Stage's
addition in isolation. This Arc's own Alpha 227 instruction asks for
something none of those did: a REAL, end-to-end exercise of REQ,
CLOSE, subscribe, unsubscribe, and Reconnect in sequence — the SAME
"verified by real execution rather than assumed from reading source
alone" discipline Alpha 217 already established for the Relay
Foundation, one Arc ago.

## 2. Verification performed (real execution)

### 2.1 REQ

`WebSocketRelay.subscribe(filters)`, against an injected fake socket
factory, sends exactly one wire message whose own decoded JSON is
`["REQ", subscriptionId, ...filters]`, where `subscriptionId` matches
the `id` field of the `FedosSubscription` the call resolves with —
confirmed by direct construction and call, not by reading
`subscribe()`'s own source alone.

### 2.2 CLOSE

`WebSocketRelay.unsubscribe(subscription)`, called with a
`FedosSubscription` obtained from a prior `subscribe()` call, sends
exactly one wire message whose own decoded JSON is
`["CLOSE", subscription.id]`.

### 2.3 subscribe

`subscribe()` rejects when called on a not-yet-connected relay, and
calls no `socket.send` in that case — confirmed for both
`WebSocketRelay` and `NullRelay`. `NullRelay.subscribe()`, once
connected, records the returned `FedosSubscription` in its own
`subscriptions` getter.

### 2.4 unsubscribe

`unsubscribe()` rejects when called on a not-yet-connected relay.
`NullRelay.unsubscribe()`, once connected, removes the matching
subscription from `subscriptions`, leaving any OTHER still-open
subscription untouched — confirming the removal is targeted by `id`,
not a blanket clear.

### 2.5 Reconnect

The FULL cycle — `connect()` → `subscribe()` → `unsubscribe()` →
`disconnect()` → `connect()` AGAIN → `subscribe()` AGAIN — succeeds on
the SAME `WebSocketRelay` instance, requesting a SECOND fresh socket
from the factory on the second `connect()` call, and successfully
sending a second REQ message with a freshly-generated (never reused)
subscription id on the second, independently-obtained socket. The SAME
sequence, run against `NullRelay`, succeeds identically at the API
level, confirming both implementations of `FedosRelay` remain
genuinely interchangeable through the interface after this Arc's own
extension.

### 2.6 No event processing, confirmed by real execution

Across every scenario in §2.1–§2.5, the fake socket's own `send` is
called exactly the expected number of times and NO listener is ever
registered for a `"message"` event type — confirming "Transport only.
No event processing." (Alpha 224) holds under REAL execution, not
merely by inspecting `subscribe()`'s own missing listener registration.

## 3. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `fedos_subscription.ts`,
  `fedos_subscription_filter.ts`, or `subscription_messages.ts` — zero
  production code change of any kind; this Stage adds test coverage
  only.
- Does **not** open any real network connection of any kind during its
  own test execution — every socket is a fake, injected via
  `FedosRelaySocketFactory`.
- Does **not** implement a Relay Pool, `EVENT`/`EOSE` delivery, or any
  capability beyond REQ/CLOSE generation and subscribe/unsubscribe
  lifecycle tracking.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  `src/nostr/*`, Storage, `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, or `package.json`.

## 4. See also

- `docs/secure_runtime_alpha_226_subscription_lifecycle.md`
- `docs/secure_runtime_alpha_225_close_generation.md`
- `docs/secure_runtime_alpha_224_req_generation.md`
- `docs/secure_runtime_alpha_217_relay_foundation_verification.md`

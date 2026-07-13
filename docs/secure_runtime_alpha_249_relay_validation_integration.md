# Secure Runtime Alpha 249 — Relay Integration Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage only
(`test/secure_runtime_alpha_249_relay_validation_integration.test.ts`)
but makes NO production-code change of any kind. This is Stage 9 of
the Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
248's own Known-Answer and Tamper Verification.**

## 1. Why now

Alpha 248 verified the validation chain in isolation; this Stage
exercises the FULL, wired-together path — a real `WebSocketRelay`
instance, an injected fake socket, `onSubscriptionMessage()` wrapped
via `createValidatedEventListener` (Alpha 246) — confirming validation
actually happens at the point a real inbound frame arrives, not merely
that the standalone functions work when called directly.

## 2. Verification performed (real execution, injected fake socket)

- **Valid EVENT reaches the validated listener.** A well-formed,
  cryptographically valid EVENT frame, fired on the fake socket's own
  captured `"message"` listener, is delivered to the wrapped validated
  listener exactly once.
- **Invalid-id EVENT does not.** An EVENT whose `event.id` does not
  match its own recomputed hash never reaches the validated listener.
- **Invalid-signature EVENT does not.** An EVENT with a correct id but
  a tampered/wrong `sig` never reaches the validated listener.
- **Malformed EVENT is rejected before validation.** A structurally
  invalid frame (wrong item count, non-hex fields) is rejected by
  `parseRelayInboundMessage` (Alpha 233, unchanged) itself — it never
  reaches `validateInboundNostrEvent` (Alpha 245) at all, confirmed by
  a validator call-count assertion.
- **Unknown subscription is ignored.** An EVENT for a subscription id
  with no registered listener of any kind produces no call, at either
  the raw or validated layer.
- **EVENT after `unsubscribe()` is ignored.** Confirmed unchanged from
  Alpha 236/239 — `unsubscribe()`'s own existing `#subscriptionListeners`
  cleanup removes validated delivery eligibility with zero new code
  (Alpha 246 §4).
- **EOSE still delivers through its existing path.** A raw listener
  registered directly via `onSubscriptionMessage()` (bypassing the
  validated adapter) still receives EOSE exactly as Alpha 237
  established — this Arc changes nothing about that path.
- **OK and NOTICE remain unchanged.** `onRelayMessage()` (Alpha 238)
  continues to deliver both, entirely independent of this Arc's own
  validation layer.
- **A throwing validated listener does not break later delivery.** A
  validated listener that throws on its first valid EVENT still allows
  a SECOND valid EVENT (same or a different subscription) to deliver
  normally afterward.
- **An invalid event does not disconnect the Relay.** `isConnected()`
  remains `true` immediately after an invalid-id or invalid-signature
  EVENT is processed.
- **A valid event after an invalid event still delivers.** Confirmed by
  firing an invalid EVENT immediately followed by a valid one, for the
  SAME subscription, and observing exactly one validated delivery.
- **Stale socket callback cannot deliver after reconnect.** The SAME
  guard Alpha 235/239 already verified for raw delivery is reconfirmed
  here for VALIDATED delivery specifically: a message fired on a
  replaced (stale) socket's own captured listener, after a second
  `connect()`, produces zero validated deliveries.
- **Multiple subscriptions do not cross-deliver.** Two independently
  `subscribe()`-d subscriptions, each wrapped with its OWN validated
  listener via `createValidatedEventListener`, each receive ONLY their
  own subscription id's own valid events.

## 3. Validation runs exactly once per candidate EVENT

Confirmed by wrapping `createValidatedEventListener`'s own internal
call to `validateInboundNostrEvent` is exercised via a call-counting
spy at the test level (never inside production code, matching Alpha
247 §5's own "internal test-only decisions may distinguish causes"
allowance) — one valid EVENT frame produces exactly one
`validateInboundNostrEvent` invocation and exactly one validated
listener call; one invalid EVENT frame produces exactly one
`validateInboundNostrEvent` invocation and zero listener calls.

## 4. What this Stage does NOT do

- Does **not** modify `websocket_relay.ts`, `fedos_relay.ts`,
  `null_relay.ts`, `combined_inbound_event_validator.ts`,
  `validated_subscription_adapter.ts`, or any other Alpha 241–246 file
  — zero production code change of any kind.
- Does **not** open any real network connection — every socket is a
  fake, injected via `FedosRelaySocketFactory`.
- Does **not** test Relay Pool, multi-relay routing, or automatic
  reconnect of any kind (none exists).
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  `src/nostr/*`, Storage, Observation,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_248_known_answer_tamper_verification.md`
- `docs/secure_runtime_alpha_246_validated_subscription_delivery.md`
- `docs/secure_runtime_alpha_239_inbound_lifecycle_verification.md`
- `docs/secure_runtime_alpha_227_subscription_foundation_verification.md`

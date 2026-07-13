# Secure Runtime Alpha 246 — Validated Subscription Delivery

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/validated_subscription_adapter.ts`. It modifies NEITHER
`fedos_relay.ts`, `null_relay.ts`, NOR `websocket_relay.ts`. This is
Stage 6 of the Alpha 241–250 Nostr Inbound Event Validation Arc,
following Alpha 245's own combined validator.**

## 1. Why now

Alpha 245 built the validator; this Stage adds the minimum boundary
this Arc's own Alpha 246 instruction asks for, so a real caller can
receive ONLY validated events from an active subscription.

## 2. Options compared

**A. Validate INSIDE `WebSocketRelay` and deliver only validated EVENT
messages.** REJECTED. "EVENT/EOSE/OK/NOTICE parsing" and
"subscription-scoped delivery" are BOTH named on this Arc's own
"Already complete and MUST NOT be redesigned" list — reaching into
`#handleSocketMessage` (Alpha 235/236) to add a validation step would
redesign the exact dispatch mechanism that list freezes.

**B. Keep raw delivery and add `onValidatedEvent(subscription,
listener)` as a third method on `FedosRelay`.** Viable, but not
adopted: it would touch `fedos_relay.ts`/`null_relay.ts`/
`websocket_relay.ts` a third time. The prior two Arcs' own experience
(Alpha 226; Alpha 236/238) already showed each such additive extension
forces updating several older tests' exact-shape assertions — a real,
recurring cost avoided entirely by Option C, which achieves the
IDENTICAL observable behavior with zero touch to any frozen file.

**C. Add a validator adapter OUTSIDE `WebSocketRelay`.**
**ADOPTED.** This Arc's own instruction names C or B as the preferred
first candidates; C carries the lower risk of the two.

**D. Replace `FedosNostrWireEvent` with validated events GLOBALLY.**
REJECTED. This Arc's own Architecture Boundary states "The validated
Nostr Event remains Nostr-specific. It must not be generalized," and
separately, collapsing the wire/validated distinction would force the
PARSER itself to perform cryptographic verification — mixing
transport and validation into one layer, against this Arc's own
explicit "Transport parses. Validator validates. Consumer consumes."
separation.

## 3. What was implemented

```ts
export type FedosValidatedEventListener = (event: FedosValidatedNostrEvent) => void;

export function createValidatedEventListener(
  listener: FedosValidatedEventListener,
): FedosSubscriptionListener
```

A caller wires validated delivery in exactly like this:

```ts
relay.onSubscriptionMessage(
  subscription,
  createValidatedEventListener((event) => { /* only ever a validated event */ }),
);
```

`onSubscriptionMessage()` (Alpha 236) is called EXACTLY as before —
`createValidatedEventListener`'s own return value is an ordinary
`FedosSubscriptionListener` (Alpha 236's own type, unchanged), so
`FedosRelay`'s own public interface needs no new method at all.

## 4. Required behaviors, each explained

- **Matching subscription only.** Unchanged: `WebSocketRelay`'s own
  EXISTING routing (Alpha 236) already delivers only to the listener
  registered for a given subscription id — this adapter runs AFTER
  that routing already happened, changing nothing about it.
- **Valid EVENT delivered exactly once.** `validateInboundNostrEvent`
  (Alpha 245) is called exactly once per candidate `"event"` message;
  on success, `listener` is called exactly once.
- **Invalid EVENT never reaches the validated listener.** A `null`
  result from `validateInboundNostrEvent` returns immediately, calling
  `listener` zero times.
- **EOSE remains a transport/lifecycle message.** This adapter's own
  returned function does nothing for `message.kind !== "event"` —
  EOSE is neither validated nor forwarded to the validated listener.
  It remains reachable ONLY through the existing raw
  `onSubscriptionMessage()` path: a caller wanting BOTH validated
  EVENT delivery AND EOSE registers its OWN combined listener, calling
  `validateInboundNostrEvent` directly for `"event"` messages and
  handling `"eose"` itself, rather than using this adapter.
- **OK and NOTICE remain relay-level messages.** Untouched —
  `onRelayMessage()` (Alpha 238) is entirely unaffected by this Stage.
- **Listener exceptions remain isolated.** `WebSocketRelay`'s own
  EXISTING per-listener `try`/`catch` (Alpha 235/236, unchanged)
  already isolates any exception this adapter's own returned function
  raises. This file ALSO wraps its own call to the wrapped `listener`
  in an inner `try`/`catch`, defense in depth: a throwing `onValid`
  callback cannot prevent this adapter's own (currently trivial, but
  future-extensible) post-delivery bookkeeping from completing.
- **`unsubscribe()` removes validated delivery eligibility.**
  Automatic and free: `unsubscribe()` (Alpha 226/236, unchanged)
  already deletes the `#subscriptionListeners` entry — since this
  adapter's own returned function IS that entry, removing it removes
  validated delivery too, with zero new code.
- **No queue, no replay, no retry.** This adapter holds no state of
  its own between calls — each invocation is independent.

## 5. Ownership, made explicit

- **Transport parses.** `WebSocketRelay`/`parseRelayInboundMessage`
  (Alpha 233/235) — untouched by this Stage.
- **Validator validates.** `validateInboundNostrEvent` (Alpha 245) —
  called by this file, never reimplemented.
- **Consumer consumes.** The caller-supplied
  `FedosValidatedEventListener` — this file only wires the consumer to
  the transport via the validator.

## 6. Structural confirmation (real inspection, this Stage)

- `fedos_relay.ts`, `null_relay.ts`, and `websocket_relay.ts` are
  BYTE-FOR-BYTE unmodified by this Stage — confirmed by `git diff`.
- `createValidatedEventListener`'s own returned function contains
  exactly one call to `validateInboundNostrEvent`.
- `FedosSubscriptionListener` (Alpha 236) is imported as a TYPE ONLY.

## 7. What this Stage does NOT do

- Does **not** add any method to `FedosRelay`.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`, or
  `websocket_relay.ts` in any way.
- Does **not** deliver EOSE, OK, or NOTICE through the validated
  listener.
- Does **not** implement a queue, replay buffer, or retry mechanism of
  any kind.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `create_runtime.ts`,
  `types.ts`, `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`
- `docs/secure_runtime_alpha_238_ok_notice_handling.md`
- `docs/secure_runtime_alpha_247_validation_failure_semantics.md`

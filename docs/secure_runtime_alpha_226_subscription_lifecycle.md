# Secure Runtime Alpha 226 — Subscription Lifecycle (subscribe/unsubscribe)

**Status: this Stage IMPLEMENTS. It modifies exactly three existing
files — `src/desktop/fedos_relay.ts`, `null_relay.ts`, and
`websocket_relay.ts` — adding no new file. This is Stage 6 of the
Alpha 221–230 Nostr Subscription Foundation Arc, and its closing
implementation Stage, following Alpha 222–225's own
`FedosSubscription`/`FedosSubscriptionFilter`/`buildReqMessage`/
`buildCloseMessage`.**

## 1. Why now

Alpha 222–225 built the TYPES and PURE message builders this Stage
needs; this Stage wires them onto the FedosRelay boundary, the exact
ADDITIVE extension Alpha 219 §3 (Relay Foundation Arc) already
previewed one Arc ago: "A future Subscription capability ... would be
a NEW method on FedosRelay ... ADDITIVE to the interface, the SAME way
disconnect()/isConnected() (Alpha 215) and publish() (Alpha 216) were
each added without touching connect()'s own already-shipped shape."

## 2. What was implemented

`FedosRelay` (`fedos_relay.ts`) gains two new methods:

```ts
subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription>;
unsubscribe(subscription: FedosSubscription): Promise<void>;
```

`WebSocketRelay` (`websocket_relay.ts`) implements both for real:

```ts
async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
  if (!this.#connected || this.#socket === undefined) {
    throw new Error("FedosRelay.subscribe() called while not connected.");
  }
  const subscription: FedosSubscription = { id: `fedos-sub-${++this.#subscriptionCounter}` };
  this.#socket.send(buildReqMessage(subscription.id, filters));
  return subscription;
}

async unsubscribe(subscription: FedosSubscription): Promise<void> {
  if (!this.#connected || this.#socket === undefined) {
    throw new Error("FedosRelay.unsubscribe() called while not connected.");
  }
  this.#socket.send(buildCloseMessage(subscription.id));
}
```

`NullRelay` (`null_relay.ts`) implements both with in-memory
bookkeeping only:

```ts
async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
  if (!this.#connected) {
    throw new Error("FedosRelay.subscribe() called while not connected.");
  }
  const subscription: FedosSubscription = { id: `fedos-sub-${++this.#subscriptionCounter}` };
  this.#subscriptions.push(subscription);
  return subscription;
}

async unsubscribe(subscription: FedosSubscription): Promise<void> {
  if (!this.#connected) {
    throw new Error("FedosRelay.unsubscribe() called while not connected.");
  }
  this.#subscriptions = this.#subscriptions.filter((s) => s.id !== subscription.id);
}
```

`NullRelay` also gains a `subscriptions: readonly FedosSubscription[]`
getter, mirroring its own existing `published` getter (Alpha 216).

## 3. Design decisions, explained

- **`subscribe()`/`unsubscribe()` require an open connection, exactly
  like `publish()`.** Both throw when `!#connected` — the SAME
  "transport requires an open connection" contract `publish()` (Alpha
  216) already enforces, so all three transport methods share one
  discipline. This is a deliberate consistency choice: a caller who
  learns `publish()`'s error-handling shape has already learned
  `subscribe()`'s and `unsubscribe()`'s.
- **`WebSocketRelay` registers NO `"message"` listener.** Matching
  Alpha 224's own "Transport only. No event processing." instruction:
  `subscribe()` sends REQ and returns immediately with the new
  `FedosSubscription` — it never waits for, or even looks at, an
  `EVENT`/`EOSE` reply. This Arc's own Goals list names no event-
  delivery capability, so none was added.
  `unsubscribe()` sends CLOSE and returns immediately.
- **`WebSocketRelay.unsubscribe()` does not validate the subscription
  id against a tracked set.** It sends CLOSE unconditionally once
  connected — the SAME "transport only, no validation" discipline
  `publish()` already applies to the events it sends (Alpha 216 never
  checks whether an event id was already published). A relay
  encountering a CLOSE for an unknown or already-closed id is expected
  to ignore it harmlessly, exactly as NIP-01 permits.
- **`NullRelay` DOES track its own subscriptions**, in a
  `#subscriptions: FedosSubscription[]` array with a `subscriptions`
  getter — the SAME reason `NullRelay.publish()` tracks `#published`:
  `NullRelay` has no real transport a test could otherwise inspect, so
  its own in-memory record IS the test's only observation point.
  `WebSocketRelay` needs no equivalent field; tests observe it through
  the injected fake socket's own `send` calls instead.
- **The subscription id is a per-instance counter (`fedos-sub-${n}`),
  never a random value.** Matching the SAME deterministic,
  inspectable-in-tests idiom the legacy (excluded) `WebSocketRelayAdapter`
  used for its own `#counter` (`src/nostr/ws_relay.ts`, Alpha 221 §2) —
  reusing the IDIOM, not the code.

## 4. Structural confirmation (real inspection, this Stage)

- `FedosRelay`'s final method set: exactly `connect`, `disconnect`,
  `isConnected`, `publish`, `subscribe`, `unsubscribe`, plus the
  `url` field — 6 methods, 1 field.
- `NullRelay`'s final public method/getter set: `constructor`,
  `connect`, `disconnect`, `isConnected`, `published`, `publish`,
  `subscriptions`, `subscribe`, `unsubscribe`.
- `WebSocketRelay`'s final public method set: `constructor`, `connect`,
  `disconnect`, `isConnected`, `publish`, `subscribe`, `unsubscribe`.
- `WebSocketRelay.subscribe()`/`unsubscribe()` each call
  `this.#socket.send(...)` EXACTLY ONCE on their own success path, and
  register NO `"message"` listener — confirmed by direct inspection:
  zero occurrence of the string `"message"` anywhere in
  `websocket_relay.ts`'s own code.
- Zero `PublishResult`-style result object, zero `accepted`/`ok`/
  `message` field, exists on either new method's own return type —
  both return `Promise<FedosSubscription>`/`Promise<void>`, matching
  `publish()`'s own "no ACK handling" discipline extended to
  subscriptions.

## 5. What this Stage does NOT do

- Does **not** add a `"message"` listener, `EVENT`/`EOSE`/`NOTICE`
  parsing, or an `onEvent` callback of any kind to `WebSocketRelay`
  or `FedosRelay`.
- Does **not** add a `RelayPool`, multi-relay routing, or any
  aggregation of multiple `FedosRelay` values.
- Does **not** validate `unsubscribe()`'s own subscription argument
  against a tracked set in `WebSocketRelay` (deliberate, §3).
- Does **not** modify `src/nostr/*`, `create_runtime.ts`, `types.ts`,
  `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, `create_desktop_application.ts`, Storage,
  Observation, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_225_close_generation.md`
- `docs/secure_runtime_alpha_224_req_generation.md`
- `docs/secure_runtime_alpha_223_filter_representation.md`
- `docs/secure_runtime_alpha_222_subscription_interface.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`

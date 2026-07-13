# Secure Runtime Alpha 236 — Subscription Event Delivery

**Status: this Stage IMPLEMENTS. It adds one new file,
`src/desktop/fedos_relay_listeners.ts`, and modifies three existing
files — `src/desktop/fedos_relay.ts`, `null_relay.ts`, and
`websocket_relay.ts`. This is Stage 6 of the Alpha 231–240 Nostr Relay
Message Reception Arc, following Alpha 235's own dispatch skeleton.**

## 1. Why now

Alpha 235 built a dispatcher with nowhere to route a parsed EVENT/EOSE
message. This Stage adds the minimum subscription-consumer boundary
this Arc's own Alpha 236 instruction asks for.

## 2. Design decision: additive method, not a `subscribe()` signature
   change

This Arc's own Alpha 236 instruction offers two candidates: changing
`subscribe()`'s own signature to accept an optional listener, or "an
additive listener-registration method if changing `subscribe` would
unnecessarily break the existing contract." `subscribe()` is
explicitly named on this Arc's own "Already complete and MUST NOT be
redesigned" list. An ADDITIVE method was adopted:

```ts
onSubscriptionMessage(
  subscription: FedosSubscription,
  listener: FedosSubscriptionListener,
): void;
```

where

```ts
export type FedosSubscriptionListener = (
  message: FedosRelayEventMessage | FedosRelayEoseMessage,
) => void;
```

A caller obtains a `FedosSubscription` from `subscribe()` (completely
unchanged — same call, same return type, same connected-gate) and
SEPARATELY registers a listener against that handle. This is the SAME
"additive method pair, never a reshaping of an already-shipped method"
discipline `subscribe()`/`unsubscribe()` were themselves built with,
one Arc ago (Alpha 226) — confirmed safest by direct experience: the
Subscription Foundation Arc's own additive extension of `FedosRelay`
(Alpha 226) already required updating several older tests' exact-shape
assertions; a NON-additive change here would multiply that cost for no
behavioral gain, since an optional trailing parameter and a separate
registration method are equally expressive.

## 3. Required behaviors, each explained

- **EVENT routed only to matching subscription.** `#handleSocketMessage`
  (Alpha 235) looks up `this.#subscriptionListeners.get(message.subscriptionId)`
  — a `Map<string, FedosSubscriptionListener>` keyed by subscription
  id. Only the listener registered for THAT exact id is ever invoked.
- **EOSE routed only to matching subscription.** Both `"event"` and
  `"eose"` messages share the exact same routing branch (both carry a
  `subscriptionId`) — see Alpha 237 for EOSE's own lifecycle meaning.
- **Unknown subscription ID ignored.** `Map.get` returning `undefined`
  short-circuits the dispatch — no throw, no fallback listener, no
  default behavior of any kind.
- **`unsubscribe()` removes delivery eligibility.** `unsubscribe()`
  (Alpha 226, its own PUBLIC contract — signature, connected-gate,
  CLOSE-sending behavior — entirely UNCHANGED) now ALSO deletes the
  matching `#subscriptionListeners` entry as an internal side effect,
  the concrete mechanism satisfying this Arc's own requirement. This is
  an internal addition, not a redesign: no existing caller's
  observable behavior (a `Promise<void>` that resolves once CLOSE is
  sent) changes in any way.
- **Duplicate subscription ID behavior, explicitly defined.** Calling
  `onSubscriptionMessage()` twice for the SAME subscription id
  OVERWRITES the previously registered listener (`Map.set` semantics,
  last-registration-wins) — verified by direct execution (Alpha 239).
- **Listener exception does not break socket processing.** Every
  listener invocation inside `#handleSocketMessage` is wrapped in its
  own `try`/`catch`, silently swallowing any exception — a throwing
  listener can neither stop a LATER message in the same frame from
  being processed nor prevent any FUTURE frame from being handled.
- **Listener cannot mutate Relay internal maps by reference.**
  `#subscriptionListeners` is a `private` (`#`-prefixed) field —
  unreachable from outside the class by JavaScript's own privacy rules.
  No getter exposes the `Map` object itself; a caller only ever hands
  in a plain function value.
- **No persistent queue, no replay, no retry.** A message that arrives
  with no listener registered (yet, or ever) is dropped, not queued —
  confirmed by the same `if (listener === undefined) return;` early
  exit that also handles the "unknown subscription" case.

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_relay_listeners.ts` exports exactly two symbols this Stage
  introduces one of: `FedosSubscriptionListener` (Alpha 236) and
  `FedosRelayMessageListener` (Alpha 238, landed in the same file, same
  commit).
- `FedosRelay` gains exactly one new method this Stage names,
  `onSubscriptionMessage()` — `void`-returning, ungated by
  `#connected`.
- `WebSocketRelay.unsubscribe()`'s own PUBLIC signature (`(subscription:
  FedosSubscription): Promise<void>`) is byte-for-byte unchanged from
  Alpha 226 — confirmed by direct inspection; only its own METHOD BODY
  gained one additional statement.
- `NullRelay.onSubscriptionMessage()` stores the listener but never
  invokes it — confirmed by `grep`: zero call-site of the stored
  listener anywhere in `null_relay.ts`.

## 5. What this Stage does NOT do

- Does **not** change `subscribe()`'s own signature, return type, or
  connected-gate behavior in any way.
- Does **not** implement EOSE's own lifecycle semantics beyond routing
  it to the same listener as EVENT — Alpha 237's own deliverable.
- Does **not** implement OK/NOTICE handling — Alpha 238's own
  deliverable (landed in the same commit, immediately following).
- Does **not** add a persistent queue, replay buffer, or retry
  mechanism of any kind.
- Does **not** modify `fedos_subscription.ts`, `fedos_subscription_filter.ts`,
  `subscription_messages.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_235_websocket_inbound_wiring.md`
- `docs/secure_runtime_alpha_238_ok_notice_handling.md`
- `docs/secure_runtime_alpha_226_subscription_lifecycle.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`

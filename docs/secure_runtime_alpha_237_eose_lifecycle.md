# Secure Runtime Alpha 237 — EOSE Lifecycle

**Status: this Stage is REVIEW ONLY. It makes NO further code change —
EOSE's own routing mechanism already exists, built by Alpha 235/236
(landed in this same commit) as part of the shared EVENT/EOSE dispatch
branch. This is Stage 7 of the Alpha 231–240 Nostr Relay Message
Reception Arc, following Alpha 236's own Subscription Event Delivery.**

## 1. Why now

This Arc's own Alpha 237 instruction asks specifically what EOSE
MEANS, and requires that meaning be honored by the delivery mechanism
Alpha 235/236 already built — the SAME "review a capability's own
semantics explicitly, never assume they generalize from a sibling
capability" discipline Alpha 219 §6 (Relay Foundation Arc) already
applied to `publish()`'s own "no ACK handling" contract one Arc ago.

## 2. What EOSE means — confirmed against this Arc's own instruction

- **The Relay reports completion of stored-event delivery for that
  subscription.** `FedosRelayEoseMessage` (Alpha 232) carries exactly
  the `subscriptionId` NIP-01's own `["EOSE", subscriptionId]` message
  states — nothing more.
- **It does NOT automatically close the subscription.** Confirmed by
  direct inspection: `#handleSocketMessage`'s own `"eose"` branch
  (Alpha 236) does exactly ONE thing — look up and invoke the
  registered `FedosSubscriptionListener`, wrapped in `try`/`catch`. It
  calls `unsubscribe()` NOWHERE, sends NO `CLOSE` wire message, and
  mutates NO field beyond the listener invocation itself.
- **It does NOT call `unsubscribe()`.** Same confirmation: `grep` for
  `unsubscribe` inside `#handleSocketMessage`'s own body finds zero
  matches.
- **Later live EVENT messages may still arrive.** Since EOSE never
  removes the `#subscriptionListeners` entry, a subsequent
  `["EVENT", subscriptionId, event]` for the SAME subscription id is
  routed to the SAME listener exactly as before EOSE arrived — verified
  by real execution (Alpha 239: "receive matching EOSE" followed by a
  later EVENT, same subscription, same listener still invoked).
- **It does NOT imply Relay disconnection.** EOSE is delivered through
  the exact same `"message"` socket event `connect()` already listens
  for (Alpha 235) — it carries no relationship to `"close"`/`"error"`
  of any kind, and `#connected`/`#socket` are untouched by the EOSE
  branch.

## 3. How EOSE is exposed to the subscription listener

`FedosSubscriptionListener` (Alpha 236) is typed
`(message: FedosRelayEventMessage | FedosRelayEoseMessage) => void` —
EOSE is delivered through the EXACT SAME callback as EVENT, discriminated
by `message.kind === "eose"`. This is "EOSE as a coarse lifecycle fact"
(this Arc's own Alpha 237 instruction): the listener learns "the Relay
has now sent everything it had stored," and nothing more — no count,
no timestamp, no partial-vs-complete distinction, no per-filter
breakdown. A caller wanting a specific action ON that fact (e.g.
switching a UI from "loading" to "live") implements it in its OWN
listener body; this Foundation supplies the fact, never the reaction.

## 4. No second Observation Framework

This Arc's own Alpha 237 instruction states: "Do not introduce a
second Observation Framework." EOSE delivery adds NO new logging,
metrics, telemetry, or event-bus mechanism of any kind — it is a
single, synchronous function call from `#handleSocketMessage` to
whatever listener a caller registered, the SAME "fire-and-forget local
callback, no framework" shape every listener in this Arc uses (Alpha
236/238). The repository's own Observation Framework (frozen, per this
Arc's own Boundary Requirements) is untouched — confirmed by `grep`:
zero reference to it anywhere in this Arc's own new/modified files.

## 5. What this Stage does NOT do

- Does **not** modify `websocket_relay.ts`, `fedos_relay.ts`,
  `null_relay.ts`, or `fedos_relay_listeners.ts` — the mechanism
  reviewed here was already complete as of Alpha 236 (same commit); no
  further code change.
- Does **not** add a second "EOSE reached" flag, counter, or state
  field of any kind to `WebSocketRelay`.
- Does **not** implement OK/NOTICE handling — Alpha 238's own
  deliverable.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `create_runtime.ts`,
  `types.ts`, `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`
- `docs/secure_runtime_alpha_235_websocket_inbound_wiring.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`
- `docs/secure_runtime_alpha_239_inbound_lifecycle_verification.md`

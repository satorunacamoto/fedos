# Secure Runtime Alpha 239 — Failure and Lifecycle Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage only
(`test/secure_runtime_alpha_239_inbound_lifecycle_verification.test.ts`)
but makes NO production-code change of any kind. This is Stage 9 of
the Alpha 231–240 Nostr Relay Message Reception Arc, following Alpha
238's own OK/NOTICE Handling — the closing implementation Stage.**

## 1. Why now

Alpha 232–238 built the inbound message model, parser, wire-event
representation, socket wiring, and both listener boundaries
incrementally; each Stage's own test suite verified its OWN addition
in relative isolation. This Arc's own Alpha 239 instruction asks for a
REAL, end-to-end exercise of the FULL scenario list against an
injected fake socket — the SAME "verified by real execution rather
than assumed from reading source alone" discipline Alpha 217/227
already established for the Relay and Subscription Foundation Arcs.

## 2. Verification performed (real execution, injected fake socket)

Every scenario below is exercised by directly constructing a
`WebSocketRelay` against a fake `FedosRelaySocketFactory`, calling its
real public methods, and firing the fake socket's own captured
listeners to simulate inbound frames — no real network I/O of any kind.

- **Connect.** `connect()` resolves, requests exactly one socket.
- **Receive valid EVENT.** A subscribed listener receives a
  `FedosRelayEventMessage` whose `event` field matches the wire payload
  field-for-field (`id`/`pubkey`/`created_at`/`kind`/`tags`/`content`/
  `sig`, unrenamed).
- **Receive matching EOSE.** The SAME listener receives a
  `FedosRelayEoseMessage` for its own subscription id; the subscription
  remains open (Alpha 237).
- **Receive OK `accepted=true`.** The relay-level listener receives a
  `FedosRelayOkMessage` with `accepted: true`.
- **Receive OK `accepted=false`.** Same listener, `accepted: false` —
  confirming both boolean states parse and deliver identically, with no
  special-cased branching.
- **Receive NOTICE.** The relay-level listener receives a
  `FedosRelayNoticeMessage` with the exact text sent.
- **Malformed JSON.** A non-JSON-parseable frame produces NO listener
  call of any kind, and `connect()`'s own socket is NOT closed.
- **Malformed array.** A structurally-invalid array (wrong tag, wrong
  item count, wrong field type) produces NO listener call.
- **Unsupported message type.** An array with an unrecognized tag
  (e.g. `["AUTH", ...]`) produces NO listener call and does not throw.
- **EVENT for unknown subscription.** An EVENT whose `subscriptionId`
  was never registered via `onSubscriptionMessage()` produces NO
  listener call.
- **EVENT after unsubscribe.** A subscription that was registered, then
  `unsubscribe()`-d, no longer receives EVENT/EOSE delivery — confirmed
  by firing an EVENT for that same subscription id AFTER `unsubscribe()`
  resolves and observing zero listener calls.
- **Multiple active subscriptions.** Two independently `subscribe()`-d
  subscriptions, each with its own listener, each receive ONLY their
  own subscription id's own messages — cross-delivery never occurs.
- **Disconnect.** `disconnect()` closes the held socket exactly once;
  `isConnected()` reports `false`.
- **Reconnect.** A full connect → subscribe → disconnect → connect →
  subscribe cycle succeeds, requesting a SECOND fresh socket.
- **No delivery through stale socket callbacks after reconnect.** A
  message fired on the FIRST (now-replaced) socket's own captured
  listener, AFTER a second `connect()` has already replaced it, produces
  NO listener call — confirming the stale-socket guard (Alpha 235) is
  real, not merely asserted by inspection.

## 3. Listener-exception isolation, verified explicitly

A subscription listener and a relay-level listener that both `throw`
on invocation are each confirmed, by real execution, to:

- **Not disconnect the Relay.** `isConnected()` remains `true`
  immediately after the throwing listener call.
- **Not prevent later messages.** A SECOND, well-behaved message fired
  immediately afterward is still delivered normally (to the SAME or a
  different listener).
- **Not corrupt subscription state.** `onSubscriptionMessage()`/
  `unsubscribe()` continue to function normally on the SAME relay
  instance after a listener has thrown.
- **Not escape into the socket runtime.** The fake socket's own
  `addEventListener`-registered callback function itself never raises
  past its own return — confirmed by invoking it directly and asserting
  no exception propagates to the test's own call site.

## 4. What this Stage does NOT do

- Does **not** modify any `src/desktop/*` file — zero production code
  change of any kind; this Stage adds test coverage only.
- Does **not** open any real network connection of any kind — every
  socket is a fake, injected via `FedosRelaySocketFactory`.
- Does **not** implement or test cryptographic verification of any
  received event.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  `src/nostr/*`, `src/sign/*`, Storage, Observation,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_238_ok_notice_handling.md`
- `docs/secure_runtime_alpha_237_eose_lifecycle.md`
- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`
- `docs/secure_runtime_alpha_235_websocket_inbound_wiring.md`
- `docs/secure_runtime_alpha_227_subscription_foundation_verification.md`
- `docs/secure_runtime_alpha_217_relay_foundation_verification.md`

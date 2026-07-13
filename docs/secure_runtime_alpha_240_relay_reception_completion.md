# Secure Runtime Alpha 240 — Relay Message Reception Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
231–240 Nostr Relay Message Reception Arc.**

## 1. Why now

Alpha 231 inventoried the existing (unsuitable for reuse) inbound-shaped
code and decided this Arc's own boundary; Alpha 232–234 built the
message model, parser, and wire-event representation; Alpha 235–238
wired reception, subscription-scoped delivery, EOSE lifecycle, and
OK/NOTICE classification into `WebSocketRelay`; Alpha 239 verified the
whole thing by real execution. This Stage issues the Arc's own closing
Completion Declaration and freezes the inbound half of the transport at
its current, deliberately minimal shape.

## 2. The Foundation, confirmed complete

```
FedosNostrWireEvent (Alpha 234)              FedosRelayInboundMessage (Alpha 232)
  id / pubkey / created_at / kind /             = EventMessage | EoseMessage
  tags / content / sig -- verbatim NIP-01         | OkMessage | NoticeMessage
  wire names, no rename, no provider field

parseRelayInboundMessage(input) -> FedosRelayInboundMessage | null   (Alpha 233)
  structural validation only -- NO cryptographic verification

FedosRelay (Alpha 212/214/215/216/226/236/238)
  readonly url: string
  connect() / disconnect() / isConnected()                    (frozen, Alpha 212/214/215)
  publish(event: FedosEventDescriptor): Promise<void>          (frozen, Alpha 216)
  subscribe(filters): Promise<FedosSubscription>                (frozen, Alpha 226)
  unsubscribe(subscription): Promise<void>                       (frozen contract; Alpha 236
                                                                    adds an internal listener-
                                                                    map cleanup side effect)
  onSubscriptionMessage(subscription, listener): void            (Alpha 236, NEW)
  onRelayMessage(listener): void                                 (Alpha 238, NEW)
        |                                    |
   NullRelay                          WebSocketRelay
   -- listener registration           -- registers ONE "message" listener in
      is bookkeeping only,               connect() (Alpha 235); parses every
      never invoked                      frame via parseRelayInboundMessage;
                                          routes EVENT/EOSE by subscriptionId,
                                          OK/NOTICE to one relay-wide listener;
                                          every listener call wrapped in its
                                          own try/catch; stale-socket guard on
                                          the message listener only

-- verified by real execution (Alpha 239): EVENT, EOSE, OK (both
   accepted states), NOTICE, malformed JSON, malformed array,
   unsupported type, unknown-subscription EVENT, post-unsubscribe
   EVENT, multi-subscription isolation, disconnect, reconnect,
   stale-callback rejection, listener-exception isolation --
```

Zero new Rust code, zero new Cargo dependency, zero new npm
dependency: `package.json`'s own `dependencies` count stays fixed at
2, unchanged across this whole Arc (Alpha 231 §3.5, reconfirmed here).
Every method this Arc's own "Already complete and MUST NOT be
redesigned" list names — `connect`/`disconnect`/`isConnected`/
`publish`/`subscribe`/`unsubscribe`, `FedosSubscription`,
`FedosSubscriptionFilter`, REQ/CLOSE generation — is confirmed
UNCHANGED in its own PUBLIC contract, by direct inspection.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE, at the deliberately
minimal scope this Arc's own Goals list named. The single-Relay NIP-01
transport foundation now covers BOTH directions: a caller can connect,
disconnect, publish an event, open and close a subscription (all
UNCHANGED from prior Arcs), and now ALSO receive and structurally
classify every inbound message category NIP-01 defines for a
subscribing/publishing client — EVENT (routed to its own subscription),
EOSE (a coarse, non-destructive lifecycle fact), OK (relay-wide,
classified accepted/rejected with its own message text), and NOTICE
(relay-wide free text) — entirely in TypeScript, entirely under
`src/desktop/`, with ZERO cryptographic validation of a received Event
of any kind (Alpha 233 §4, reconfirmed by Alpha 239's own real
execution never invoking a signature check), ZERO Relay Pool, ZERO
multi-relay routing, ZERO automatic reconnect or retry of any kind,
ZERO event persistence, ZERO event decryption, ZERO DM capability, ZERO
GUI, ZERO Worker integration, ZERO AppRuntime change, ZERO Observation
Framework change, ZERO new Cargo/npm dependency, and ZERO reference to
the pre-existing, request/response-oriented
`src/nostr/relay.ts`/`ws_relay.ts`/`publish.ts`/`messages.ts` (Alpha
231, reconfirmed unchanged throughout this Arc).**

**The following do NOT exist yet, exactly as this Arc's own Goals and
"Do NOT implement"/"Absolute Prohibitions" lists require:**

- **Cryptographic validation of received Events, unless safely reused
  here** — NOT reused. Alpha 231 §3.4 found `NobleSignatureVerifier`
  real and reusable in principle; this Arc deliberately did not wire it
  in, leaving `FedosNostrWireEvent` values structurally-checked but
  UNVERIFIED, matching Alpha 233's own "parsing success must not imply
  cryptographic validity" instruction exactly.
- **Relay Pool, deduplication across Relays** — `FedosRelay` still
  names exactly one connection target; no multi-relay aggregation type
  of any kind exists.
- **Automatic reconnect, backoff, persistent subscriptions, storage** —
  a `"close"`/`"error"` event still only clears local state (Alpha
  214/215, unchanged); no retry, backoff timer, or persistence
  mechanism of any kind was added.
- **DM, NIP-42 authentication, NIP-46, NIP-05, GUI** — none was added
  or touched; `desktop_application.ts` and `create_desktop_application.ts`
  remain byte-for-byte unmodified by this Arc, the SAME judgment Alpha
  218/228 already made for the Relay and Subscription Foundation Arcs,
  for the SAME reason: no caller yet exists to justify the wiring cost.
- **A public Runtime/`AppRuntime` API for inbound Relay messages** —
  every new symbol in this Arc is reachable only from `src/desktop/*`
  imports; `create_runtime.ts`/`types.ts`/`worker.ts` carry zero
  reference.

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
scope boundary, matching this Arc's own preferred recommendation
exactly:** **Nostr Inbound Event Validation Arc.** Alpha 231 §3.4/§3.5
and Alpha 233 §4 already reviewed exactly what that Arc would need: a
real, reusable Schnorr verifier (`NobleSignatureVerifier`) and a real,
reusable id-hash check (`verifyEventId`) both already exist in
`src/nostr/*`, and this Arc's own Boundary Requirements ("keep
ownership and types explicit" rather than "silently mixed") mean that
Arc's own first Stage would need to decide, deliberately, how a
`FedosNostrWireEvent` gets checked — either via a small, explicit
Desktop-owned adapter to the legacy verifier, or a fresh,
independent implementation — before a `FedosNostrWireEvent` can
honestly become a trusted `FedosEventDescriptor`. Per this Arc's own
instruction, **Relay Pool must not be recommended until a single Relay
can receive and validate events honestly** — that condition is not yet
met (validation itself does not yet exist), so Relay Pool remains
explicitly out of scope for the immediate next Arc too.

## 4. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_relay_inbound_message.ts`,
  `relay_inbound_parser.ts`, `fedos_nostr_wire_event.ts`,
  `fedos_relay_listeners.ts`, `fedos_relay.ts`, `null_relay.ts`, or
  `websocket_relay.ts` beyond what Alpha 232–238 already landed — no
  further production code change.
- Does **not** wire this Arc's own inbound capability into
  `DesktopApplication`, `AppRuntime`, or any Runtime/Worker construct.
- Does **not** implement cryptographic validation, Relay Pool,
  automatic reconnect, persistent subscriptions, storage, DM, NIP-42,
  NIP-46, NIP-05, or GUI.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `src/identity/*`, `src/nostr/*`,
  `src/sign/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_239_inbound_lifecycle_verification.md`
- `docs/secure_runtime_alpha_238_ok_notice_handling.md`
- `docs/secure_runtime_alpha_237_eose_lifecycle.md`
- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`
- `docs/secure_runtime_alpha_235_websocket_inbound_wiring.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
- `docs/secure_runtime_alpha_233_nip01_relay_wire_parser.md`
- `docs/secure_runtime_alpha_232_relay_inbound_message_model.md`
- `docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md`
- `docs/secure_runtime_alpha_230_subscription_foundation_completion.md`

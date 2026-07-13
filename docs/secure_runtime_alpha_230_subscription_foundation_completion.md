# Secure Runtime Alpha 230 — Subscription Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
221–230 Nostr Subscription Foundation Arc.**

## 1. Why now

Alpha 221 reviewed the existing (unsuitable) Subscription-shaped code
and decided this Arc's own boundary; Alpha 222–226 built
`FedosSubscription`/`FedosSubscriptionFilter`/`buildReqMessage`/
`buildCloseMessage`/`subscribe`/`unsubscribe` incrementally —
identifier, filter, REQ, CLOSE, lifecycle, in that order; Alpha 227
verified the whole Foundation by real execution; Alpha 228–229
reviewed the Runtime Boundary and future extensibility. This Stage
issues the Arc's own closing Completion Declaration and freezes the
Subscription Foundation at its current, deliberately minimal shape.

## 2. The Foundation, confirmed complete

```
FedosSubscription (Alpha 222)              FedosSubscriptionFilter (Alpha 223)
  readonly id: string                        readonly ids?: readonly string[]
                                              readonly authors?: readonly string[]
                                              readonly kinds?: readonly number[]
                                              readonly since?: number
                                              readonly until?: number
                                              readonly limit?: number

buildReqMessage(id, filters) -> string       buildCloseMessage(id) -> string
  (Alpha 224, subscription_messages.ts)        (Alpha 225, subscription_messages.ts)
  ["REQ", id, ...filters]                      ["CLOSE", id]

FedosRelay (Alpha 212/214/215/216/226)
  readonly url: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  publish(event: FedosEventDescriptor): Promise<void>
  subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription>   (Alpha 226)
  unsubscribe(subscription: FedosSubscription): Promise<void>                          (Alpha 226)
        |                                    |
   NullRelay                          WebSocketRelay
   — in-memory `subscriptions` list,  — sends buildReqMessage/buildCloseMessage
     no networking                      over the injected socket, NO "message"
                                         listener, NO EVENT/EOSE processing

-- verified by real execution (Alpha 227): REQ, CLOSE, subscribe,
   unsubscribe, Reconnect, cross-implementation parity --
```

Zero new Rust code, zero new Cargo dependency, zero new npm
dependency: `package.json`'s own `dependencies` count stays fixed at
2, unchanged across this whole Arc (Alpha 221 §5, Alpha 228 §5,
reconfirmed here). `FedosRelay`'s pre-existing four methods
(`connect`/`disconnect`/`isConnected`/`publish`) are UNCHANGED —
`subscribe()`/`unsubscribe()` are purely additive, honoring this Arc's
own "Relay Foundation MUST NOT be redesigned" instruction.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE, at the deliberately
minimal scope this Arc's own Goals list named. A caller holding a
connected `FedosRelay` can now open a subscription against an
arbitrary list of `FedosSubscriptionFilter` values, receive back an
opaque `FedosSubscription` handle, and later close that exact
subscription — entirely in TypeScript, entirely under
`src/desktop/`, with ZERO Relay Pool, ZERO multi-relay routing
(Alpha 229), ZERO `EVENT`/`EOSE`/`NOTICE` processing or `"message"`
listener of any kind ever registered by production code (Alpha 226 §4,
reconfirmed by Alpha 227 §2.6's own real execution), ZERO GUI, ZERO
Worker integration, ZERO Storage, ZERO Observation, ZERO AppRuntime
redesign (Alpha 228), ZERO new Cargo/npm dependency, and ZERO
reference to the pre-existing, request/response-oriented
`src/nostr/relay.ts`/`ws_relay.ts`/`messages.ts` (Alpha 221,
reconfirmed unchanged throughout this Arc).**

**The following do NOT exist yet, exactly as this Arc's own Goals and
"Do NOT implement" list require:**

- **Relay Pool, multi-relay routing** — `FedosRelay` still names
  exactly one connection target and one independent subscription
  counter per instance; no multi-relay aggregation type of any kind
  exists (Alpha 229 §2 reviewed how one WOULD compose, without
  building it).
- **`EVENT`/`EOSE` delivery** — `subscribe()` sends REQ and returns; it
  never receives, parses, or delivers an incoming Nostr event to any
  caller. A subscription opened by this Foundation produces no
  observable effect beyond the wire message itself and the returned
  handle.
- **NIP-05, NIP-46, GUI, Worker integration, Storage, Observation** —
  none was added or touched; `desktop_application.ts` and
  `create_desktop_application.ts` remain byte-for-byte unmodified by
  this Arc (Alpha 228 §2), the SAME judgment Alpha 218 already made for
  the Relay boundary one Arc ago, for the SAME reason: no caller yet
  exists to justify the wiring cost against this repository's own
  large regression-test suite.
- **A public Runtime/`AppRuntime` API for Subscription** —
  `FedosSubscription`/`FedosSubscriptionFilter`/`subscribe`/
  `unsubscribe` are reachable only from `src/desktop/*` imports;
  `create_runtime.ts`/`types.ts`/`worker.ts` carry zero reference
  (Alpha 228 §3).

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
scope boundary:** **Nostr Subscription Event Delivery Foundation.**
Alpha 224's own "No event processing" scope boundary is the natural
next Arc's own starting point: a `WebSocketRelay` that finally
registers a `"message"` listener, matches incoming `["EVENT",
subscriptionId, event]` messages against the subscription id
`subscribe()` returned, and delivers the mapped `FedosEventDescriptor`
to a caller-supplied callback (or `["EOSE", subscriptionId]"` as an
end-of-stored-events signal) — the SAME "review the ACK/response
contract fresh, never inherit `publish()`'s own unchanged" discipline
Alpha 219 §6 already flagged one Arc ago for exactly this future
capability. Relay Pool and `DesktopApplication` wiring remain
explicitly OUT of scope for that next Arc too, exactly as they were
out of scope here — those require their own, later, separately-
reviewed Arc once a real caller and a real multi-relay use case exist
to justify either cost.

## 4. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_subscription.ts`,
  `fedos_subscription_filter.ts`, `subscription_messages.ts`,
  `fedos_relay.ts`, `null_relay.ts`, or `websocket_relay.ts` beyond
  what Alpha 222–226 already landed — no further production code
  change.
- Does **not** wire the Subscription Foundation into
  `DesktopApplication`, `AppRuntime`, or any Runtime/Worker construct.
- Does **not** implement Relay Pool, `EVENT`/`EOSE` delivery, NIP-05,
  NIP-46, GUI, Worker integration, Storage, or Observation.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `src/identity/*`, `src/nostr/*`,
  `src/sign/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_229_subscription_extensibility_review.md`
- `docs/secure_runtime_alpha_228_subscription_boundary_review.md`
- `docs/secure_runtime_alpha_227_subscription_foundation_verification.md`
- `docs/secure_runtime_alpha_226_subscription_lifecycle.md`
- `docs/secure_runtime_alpha_225_close_generation.md`
- `docs/secure_runtime_alpha_224_req_generation.md`
- `docs/secure_runtime_alpha_223_filter_representation.md`
- `docs/secure_runtime_alpha_222_subscription_interface.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`
- `docs/secure_runtime_alpha_220_relay_foundation_completion.md`

# Secure Runtime Alpha 220 — Relay Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
211–220 Nostr Relay Foundation Arc.**

## 1. Why now

Alpha 211 reviewed the existing (unsuitable) Relay code and decided
this Arc's own boundary; Alpha 212–216 built `FedosRelay`/`NullRelay`/
`WebSocketRelay` incrementally — interface, Null implementation,
connection, lifecycle, publish, in that order; Alpha 217 verified the
whole Foundation by real execution; Alpha 218–219 reviewed the
Runtime Boundary and future extensibility. This Stage issues the
Arc's own closing Completion Declaration and freezes the Relay
Foundation at its current, deliberately minimal shape.

## 2. The Foundation, confirmed complete

```
FedosRelay (Alpha 212/214/215/216)
  readonly url: string                                    (Alpha 212)
  connect(): Promise<void>                                (Alpha 214)
  disconnect(): Promise<void>                              (Alpha 215)
  isConnected(): boolean                                   (Alpha 215)
  publish(event: FedosEventDescriptor): Promise<void>       (Alpha 216)
        ↑                                    ↑
   NullRelay                          WebSocketRelay
   (Alpha 213/214/215/216)            (Alpha 214/215/216)
   — no networking,                   — injected FedosRelaySocketFactory,
     in-memory bookkeeping only         never `new WebSocket(...)`
                                        — publish() maps FedosEventDescriptor
                                          onto NIP-01 wire JSON internally,
                                          sends ["EVENT", wireEvent] once,
                                          NEVER waits for ["OK", ...]

-- verified by real execution (Alpha 217): Connect, Disconnect,
   Publish, Reconnect, cross-implementation parity --
```

Zero new Rust code, zero new Cargo dependency, zero new npm
dependency: `package.json`'s own `dependencies` count stays fixed at
2, unchanged across this whole Arc (Alpha 211 §5, Alpha 218 §5,
reconfirmed here). `FedosEventDescriptor` (Alpha 202) is REUSED
verbatim as the input to `publish()` — this Arc's own "MUST NOT
redesign: Event" instruction honored throughout, confirmed by every
Stage's own structural checks (Alpha 216 §9, Alpha 219 §7).

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE, at the deliberately
minimal scope this Arc's own Goals list named. A single `FedosRelay`
connection target can now be constructed, connected to, disconnected
from, queried for its own current connection state, and used to
publish an existing, already-signed `FedosEventDescriptor` as NIP-01
wire JSON — entirely in TypeScript, entirely under `src/desktop/`,
with ZERO Relay Pool, ZERO Subscription, ZERO REQ/CLOSE message of any
kind ever SENT by production code (Alpha 219 §7), ZERO ACK/OK waiting
of any kind (Alpha 216, reconfirmed by Alpha 217 §2.3's own real
execution), ZERO new Cargo/npm dependency, ZERO AppRuntime/Worker
reference (Alpha 218), and ZERO reference to the pre-existing, REQ/
EOSE/CLOSE/Filter/ACK-oriented `src/nostr/relay.ts`/`ws_relay.ts`/
`publish.ts` (Alpha 211, reconfirmed unchanged throughout this Arc).**

**The following do NOT exist yet, exactly as this Arc's own Goals and
"Do NOT implement" list require:**

- **REQ, CLOSE, Subscription, Filters** — no subscription mechanism,
  no filter vocabulary, no wire message beyond `["EVENT", ...]` exists
  anywhere in this Arc's own three files.
- **Relay Pool** — `FedosRelay` still names exactly one connection
  target; no multi-relay aggregation type of any kind exists.
- **NIP-05, NIP-46, NIP-07** — no identity-verification, remote
  signing, or browser-extension-signer capability was added or
  touched; `src/sign/nip07.ts` remains exactly as Alpha 211 §2 found
  it.
- **A public Runtime/`AppRuntime` API for Relay** —
  `FedosRelay`/`NullRelay`/`WebSocketRelay` are reachable only from
  `src/desktop/*` imports; `create_runtime.ts`/`types.ts`/`worker.ts`
  carry zero reference (Alpha 218 §3).
- **`DesktopApplication` wiring** — `desktop_application.ts` and
  `create_desktop_application.ts` remain byte-for-byte unmodified by
  this Arc (Alpha 218 §2), the SAME judgment Alpha 203 already made
  for the Event Reader boundary one Arc ago, for the SAME reason: no
  caller yet exists to justify the wiring cost against ~40+ Stages'
  worth of `DesktopApplication` regression tests.

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
scope boundary:** **Nostr Relay Subscription & REQ/CLOSE
Foundation.** Alpha 219 §3–§5 already reviewed exactly how a future
Subscription capability would extend `FedosRelay` — an ADDITIVE
`subscribe()` method, an internal `WebSocketRelay`-only REQ/CLOSE wire
encoding, and its own separately-reviewed ACK/response contract (§6,
explicitly NOT inherited unchanged from `publish()`'s own "no ACK
handling") — the NEXT natural, lower-risk step is building exactly
that, now that a real, verified Connect/Disconnect/Publish Foundation
exists under it. Relay Pool and `DesktopApplication` wiring remain
explicitly OUT of scope for that next Arc too, exactly as they were
out of scope here — those require their own, later, separately-
reviewed Arc once a real caller and a real multi-relay use case exist
to justify either cost.

## 4. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_relay.ts`, `null_relay.ts`,
  or `websocket_relay.ts` beyond what Alpha 212–216 already landed —
  no further production code change.
- Does **not** wire the Relay Foundation into `DesktopApplication`,
  `AppRuntime`, or any Runtime/Worker construct — §3's own "does NOT
  exist yet" list is a finding, not an implementation.
- Does **not** implement Relay Pool, Subscription, REQ, CLOSE, Filters,
  NIP-05, NIP-46, or NIP-07.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `src/identity/*`, `src/nostr/*`,
  `src/sign/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`
- `docs/secure_runtime_alpha_218_relay_boundary_review.md`
- `docs/secure_runtime_alpha_217_relay_foundation_verification.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_215_connection_lifecycle.md`
- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
- `docs/secure_runtime_alpha_213_null_relay.md`
- `docs/secure_runtime_alpha_212_relay_interface.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_210_event_runtime_boundary_completion.md`

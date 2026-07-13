# Secure Runtime Alpha 219 — Relay Future Extensibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 9 of the Alpha 211–220 Nostr Relay Foundation Arc, following
Alpha 218's own Relay Boundary Review.**

## 1. Why now

This Arc's own Alpha 219 instruction states plainly: "Future
extensibility review. Confirm compatibility with Relay Pool,
Subscription, REQ, CLOSE." All four are explicitly OUT of THIS Arc's
own scope (its own instruction list), but a real transport Foundation
that could not later support them would be a foundation built on the
wrong shape. This Stage reviews each of the four against the CURRENT
`FedosRelay` interface, the SAME kind of forward-compatibility check
Alpha 199/208 already ran for the Event Foundation, and Alpha 179/188
for the Identifier/Signature layers.

## 2. Relay Pool — compatible, composes OVER `FedosRelay`, never inside
   it

`FedosRelay` (Alpha 212) already names "exactly one connection
target" BY DESIGN (Alpha 212 §2) — a future `RelayPool` would hold a
COLLECTION of `FedosRelay` VALUES (e.g. `Map<string, FedosRelay>`,
keyed by `url`), fanning `connect()`/`disconnect()`/`publish()` calls
out to each member and aggregating `isConnected()` across the set.
`FedosRelay` itself needs NO change for this — a Pool is a NEW type
that CONSUMES multiple `FedosRelay` values, exactly as
`NostrPublicIdentityReader` (Alpha 103) CONSUMES a
`FedosNostrPublicIdentitySource` without either type needing to know
about the other's own composition. `WebSocketRelay`'s own constructor
already takes a single `url` (Alpha 214) — nothing about its own shape
assumes it is the only relay in play.

## 3. Subscription — compatible, requires a NEW method, never a
   reshaping of `publish()`

A future Subscription capability (receiving events FROM a relay, the
mirror of `publish()`'s own "send an event TO a relay") would be a
NEW method on `FedosRelay` — something like
`subscribe(onEvent: (event: FedosEventDescriptor) => void): Promise<FedosSubscriptionHandle>`
— ADDITIVE to the interface, the SAME way `disconnect()`/
`isConnected()` (Alpha 215) and `publish()` (Alpha 216) were each
added without touching `connect()`'s own already-shipped shape. It
would need `WebSocketRelay` to finally register a `"message"`
listener (Alpha 216 §HARD GUARDRAILS confirmed none exists today) —
that listener's own absence today is a scope boundary, not a
structural obstacle to adding one later.

## 4. REQ — compatible, lives entirely inside a future Subscription
   implementation, never in `FedosRelay` itself

REQ is NIP-01's own WIRE MESSAGE for opening a subscription — the SAME
relationship `["EVENT", ...]` already has to `publish()` (Alpha 216):
the wire message is an internal encoding detail of ONE implementation
(`WebSocketRelay`), never a concept the protocol-independent
`FedosRelay` interface itself needs to name. A future
`WebSocketRelay.subscribe()` would send `["REQ", subId, ...filters]`
internally, exactly as `publish()` today sends `["EVENT", wireEvent]`
internally — `src/nostr/ws_relay.ts`'s own PRE-EXISTING REQ-sending
code (Alpha 211 §2) remains available as prior art for that future
implementation to consult, even though this Arc's own `WebSocketRelay`
shares no code with it.

## 5. CLOSE — compatible, the natural counterpart to a future
   Subscription's own unsubscribe

CLOSE ends a subscription that REQ opened — a future
`FedosSubscriptionHandle.close(): Promise<void>` (returned by the
hypothetical `subscribe()` in §3) would send `["CLOSE", subId]`
internally, mirroring `disconnect()`'s own already-shipped "closes
something previously opened" shape (Alpha 215) one level down (a
subscription, not the whole connection). It requires no change to
`FedosRelay.disconnect()` itself, which continues to mean "close the
WHOLE connection," never "close one subscription."

## 6. What does NOT generalize — confirmed, not assumed

`FedosRelay.publish()`'s own "Transport only, no ACK handling"
contract (Alpha 216) is SPECIFIC to publishing — a future Subscription
capability is fundamentally different (it is inherently
response-driven: without SOME mechanism to receive `["EVENT", ...]`
messages, a subscription is pointless) — so "no ACK handling" is NOT a
principle a future Subscription Stage should try to inherit unchanged;
that Stage's own review would need to decide its OWN contract, the
SAME "don't assume, review" discipline Alpha 199 §3 already applied
across protocol boundaries, now applied across CAPABILITIES within the
SAME protocol.

## 7. Structural confirmation (real inspection, this Stage)

- `FedosRelay`'s own four methods (`connect`/`disconnect`/
  `isConnected`/`publish`) plus `url`: unchanged since Alpha 216,
  reconfirmed here.
- Zero reference to `REQ`, `CLOSE`, `Subscription`, `Filter`, or `Pool`
  exists anywhere in `fedos_relay.ts`, `null_relay.ts`, or
  `websocket_relay.ts`'s own CODE (doc-comment mentions discussing
  these as forbidden guardrails, or as this Stage's own review topic,
  are expected and excluded from this check).

## 8. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a `RelayPool`, `subscribe()`, `FedosSubscriptionHandle`,
  or any REQ/CLOSE-sending code of any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 9. See also

- `docs/secure_runtime_alpha_218_relay_boundary_review.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_199_event_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md`

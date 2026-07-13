# Secure Runtime Alpha 217 — Relay Foundation Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage only
(`test/secure_runtime_alpha_217_relay_foundation_verification.test.ts`)
but makes NO production-code change of any kind. This is Stage 7 of
the Alpha 211–220 Nostr Relay Foundation Arc, following Alpha 216's
own Publish API — the closing implementation Stage.**

## 1. Why now

Alpha 212–216 built `FedosRelay`/`NullRelay`/`WebSocketRelay`
incrementally; Alpha 212–216's own test suites each verified their OWN
Stage's addition in isolation. This Arc's own Alpha 217 instruction
asks for something none of those did: a REAL, end-to-end exercise of
the FULL lifecycle in sequence — Connect, Disconnect, Publish,
Reconnect — the SAME "verified by real execution rather than assumed
from reading source alone" discipline Alpha 196 already established
for the Event Foundation, and Alpha 209 for the Event Runtime
Exposure boundary, now applied to the Relay Foundation.

## 2. Verification performed (real execution)

### 2.1 Connect

`WebSocketRelay.connect()`, against an injected fake socket factory,
resolves, requests exactly one socket for the configured `url`, and
leaves `isConnected()` reporting `true` — confirmed by direct
construction and call, not by reading `connect()`'s own source alone.

### 2.2 Disconnect

`WebSocketRelay.disconnect()`, called on a connected instance, closes
the held fake socket exactly once and leaves `isConnected()` reporting
`false`.

### 2.3 Publish

`WebSocketRelay.publish(event)`, called on a connected instance, sends
exactly one `["EVENT", wireEvent]` message whose own `wireEvent` field
values match the SAME `FedosEventDescriptor` supplied to `publish()`
itself, mapped through the `author`→`pubkey`/`createdAt`→`created_at`/
`signature`→`sig` rule Alpha 216 established, and resolves without
waiting for any further socket activity — confirming "Transport only,
no ACK handling" holds under REAL execution, not merely by inspecting
`publish()`'s own missing `"message"` listener.

### 2.4 Reconnect

The FULL cycle — `connect()` → `publish()` → `disconnect()` →
`connect()` AGAIN → `publish()` AGAIN — succeeds on the SAME
`WebSocketRelay` instance, requesting a SECOND fresh socket from the
factory on the second `connect()` call (never reusing the first,
now-closed one), and successfully sending a second `["EVENT", ...]`
message on the second, independently-obtained socket. This confirms
`WebSocketRelay` is not a single-use object — a disconnected instance
is a fully reusable starting point for a new connection, the exact
"Reconnect" property this Arc's own Alpha 217 instruction names.

### 2.5 Cross-implementation parity

The SAME four-step sequence (connect/publish/disconnect/reconnect),
run against `NullRelay` instead of `WebSocketRelay`, succeeds
identically at the API level (no exception, `isConnected()` tracks the
same true/false transitions, `publish()` after `disconnect()`-then-
`connect()` succeeds again) — confirming both implementations of
`FedosRelay` are genuinely interchangeable through the interface, not
merely by type-checking.

## 3. What this Stage does NOT do

- Does **not** modify `src/desktop/fedos_relay.ts`, `null_relay.ts`,
  or `websocket_relay.ts` — zero production code change of any kind;
  this Stage adds test coverage only.
- Does **not** open any real network connection of any kind during its
  own test execution — every socket is a fake, injected via
  `FedosRelaySocketFactory`.
- Does **not** implement REQ, CLOSE, Subscription, Filters, or a Relay
  Pool of any kind.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  `src/nostr/*`, Storage, `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, or `package.json`.

## 4. See also

- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_215_connection_lifecycle.md`
- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
- `docs/secure_runtime_alpha_196_event_foundation_verification.md`
- `docs/secure_runtime_alpha_209_end_to_end_verification.md`

# Secure Runtime Alpha 224 — REQ Generation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/subscription_messages.ts`, exporting `buildReqMessage`.
This is Stage 4 of the Alpha 221–230 Nostr Subscription Foundation
Arc, following Alpha 223's own `FedosSubscriptionFilter`.**

## 1. Why now

`FedosRelay.subscribe()` (Alpha 226) will need to send a REQ wire
message; this Stage builds the PURE function that produces that wire
string first, mirroring the SAME "encode the wire shape as a small,
pure, internal detail" idiom `WebSocketRelay.publish()`
(`websocket_relay.ts`, Alpha 216, Relay Foundation Arc) already
established for `["EVENT", wireEvent]`.

## 2. What was implemented

```ts
export function buildReqMessage(
  subscriptionId: string,
  filters: readonly FedosSubscriptionFilter[],
): string {
  return JSON.stringify(["REQ", subscriptionId, ...filters]);
}
```

A PURE function: given a subscription id and a list of filters, it
returns the NIP-01 REQ wire string, `["REQ", subscriptionId,
...filters]`. It performs NO socket I/O, NO subscription-id generation,
and registers NO listener of any kind.

## 3. "Transport only. No event processing." — the scope decision,
   honored precisely

This Arc's own Alpha 224 instruction states plainly: "Implement REQ
generation. Transport only. No event processing." Three consequences
follow directly:

- **This function does not send anything.** It returns a `string`; the
  caller (Alpha 226's own `WebSocketRelay.subscribe()`) is responsible
  for actually calling `socket.send(...)` with the result.
- **This function does not generate the subscription id.** The id is
  always supplied by the caller — `buildReqMessage` has no counter, no
  random-id generator, and no module-level mutable state of any kind.
  Id generation is Alpha 226's own concern (a fresh id per `subscribe()`
  call, scoped to the owning `FedosRelay` instance).
- **This function has no knowledge of `EVENT`/`EOSE`/`NOTICE`.** It
  never parses, awaits, or otherwise processes a relay's own reply to
  the REQ it builds — this file imports nothing from
  `src/nostr/messages.ts` and defines no message-parsing logic of any
  kind.

## 4. Structural confirmation (real inspection, this Stage)

- `subscription_messages.ts` exports exactly one symbol at this Stage,
  `buildReqMessage` (Alpha 225 adds a second, `buildCloseMessage`, in
  the same file — landed together in this Arc's single commit).
- `buildReqMessage` imports `FedosSubscriptionFilter` (Alpha 223) as a
  TYPE ONLY (`import type`).
- Zero `socket`, `WebSocket`, `fetch`, or network reference of any kind
  exists in this file.
- Zero mutable module-level state (`let`, counter, `Map`) exists in
  this file — `buildReqMessage` is a PURE function of its own two
  arguments.

## 5. What this Stage does NOT do

- Does **not** implement `buildCloseMessage` — Alpha 225's own
  deliverable (landed in the same file, same commit, per this Arc's
  single-commit instruction).
- Does **not** add `subscribe()`/`unsubscribe()` to `FedosRelay` — Alpha
  226's own deliverable.
- Does **not** call `socket.send(...)`, open a connection, or generate
  a subscription id of any kind.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `create_runtime.ts`, `types.ts`,
  `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_223_filter_representation.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`

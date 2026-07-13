# Secure Runtime Alpha 225 — CLOSE Generation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/subscription_messages.ts`, adding one new function,
`buildCloseMessage`. This is Stage 5 of the Alpha 221–230 Nostr
Subscription Foundation Arc, following Alpha 224's own
`buildReqMessage`.**

## 1. Why now

`FedosRelay.unsubscribe()` (Alpha 226) will need to send a CLOSE wire
message — the natural counterpart to `subscribe()`'s own REQ. This
Stage builds that PURE function, completing the message-builder pair
before Alpha 226 wires either one into a real `socket.send(...)` call.

## 2. What was implemented

```ts
export function buildCloseMessage(subscriptionId: string): string {
  return JSON.stringify(["CLOSE", subscriptionId]);
}
```

A PURE function: given a subscription id, it returns the NIP-01 CLOSE
wire string, `["CLOSE", subscriptionId]`. Same discipline as
`buildReqMessage` (Alpha 224): no socket I/O, no state, no relay-reply
processing of any kind.

## 3. Requirements — satisfied item by item

- **Pure.** No socket, no `fetch`, no `WebSocket`, no mutable
  module-level state — a single-expression function of its own one
  argument.
- **No subscription-tracking.** `buildCloseMessage` does not check
  whether `subscriptionId` was ever actually opened via a prior
  `buildReqMessage` call — that is Alpha 226's own concern (and, per
  Alpha 226's own design, `WebSocketRelay.unsubscribe()` deliberately
  does NOT validate this either, trusting the relay to ignore a CLOSE
  for an unknown id, exactly as NIP-01 permits).
- **No event processing.** This function has no knowledge of `EVENT`/
  `EOSE`/`NOTICE`/`OK` of any kind — closing a subscription is a
  fire-and-forget wire message, not a request awaiting a reply.

## 4. Structural confirmation (real inspection, this Stage)

- `subscription_messages.ts` now exports exactly two symbols,
  `buildReqMessage` (Alpha 224) and `buildCloseMessage` (this Stage) —
  the FINAL, complete shape of this file for this Arc.
- `buildCloseMessage` imports nothing beyond what `buildReqMessage`
  already imports — no new import was needed.
- Zero mutable module-level state exists anywhere in this file.

## 5. What this Stage does NOT do

- Does **not** add `subscribe()`/`unsubscribe()` to `FedosRelay` — Alpha
  226's own deliverable.
- Does **not** call `socket.send(...)`, open or close a connection, or
  validate a subscription id against any tracked set.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `create_runtime.ts`, `types.ts`,
  `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_224_req_generation.md`
- `docs/secure_runtime_alpha_223_filter_representation.md`
- `docs/secure_runtime_alpha_215_connection_lifecycle.md`

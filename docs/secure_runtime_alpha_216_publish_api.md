# Secure Runtime Alpha 216 — Publish API

**Status: this Stage IMPLEMENTS. It edits exactly three existing
files — `src/desktop/fedos_relay.ts`, `src/desktop/null_relay.ts`,
and `src/desktop/websocket_relay.ts` — to add one method, `publish()`,
to each. No new file is added. This is Stage 6 of the Alpha 211–220
Nostr Relay Foundation Arc, following Alpha 215's own Connection
Lifecycle, and the closing implementation Stage of the Foundation
itself — Alpha 217–220 are review/verification only.**

## 1. Why now

`FedosRelay` can now connect, disconnect, and report its own state,
but has no way to send an Event. This Stage adds the LAST capability
this Arc's own Goals list names: "Event publishing transport" —
deliberately TRANSPORT ONLY, with "No ACK handling" (this Arc's own
Alpha 216 instruction, quoted verbatim).

## 2. What was implemented

`src/desktop/fedos_relay.ts`:

```ts
import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";

export interface FedosRelay {
  readonly url: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  publish(event: FedosEventDescriptor): Promise<void>;
}
```

`src/desktop/websocket_relay.ts`:

```ts
async publish(event: FedosEventDescriptor): Promise<void> {
  if (!this.#connected || this.#socket === undefined) {
    throw new Error("FedosRelay.publish() called while not connected.");
  }
  const wireEvent = {
    id: event.id,
    pubkey: event.author,
    created_at: event.createdAt,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.signature,
  };
  this.#socket.send(JSON.stringify(["EVENT", wireEvent]));
}
```

`src/desktop/null_relay.ts`:

```ts
async publish(event: FedosEventDescriptor): Promise<void> {
  if (!this.#connected) {
    throw new Error("FedosRelay.publish() called while not connected.");
  }
  this.#published.push(event);
}
```

- `FedosEventDescriptor` (Alpha 202) is REUSED verbatim, imported as a
  type only — this Arc's own "MUST NOT redesign: Event" instruction is
  honored by never inventing a parallel Event shape.
- `publish()` returns `Promise<void>` on BOTH implementations — no
  result object, no `accepted`/`ok`/`message` field, no acknowledgement
  of any kind. `WebSocketRelay.publish()` calls `socket.send(...)`
  exactly once and resolves as soon as that call returns — it never
  registers a `"message"` listener, never waits for the relay's own
  `["OK", ...]` response.
- The wire mapping (`author`→`pubkey`, `createdAt`→`created_at`,
  `signature`→`sig`; `id`/`kind`/`tags`/`content` verbatim; `provider`
  dropped) happens ENTIRELY inside `WebSocketRelay` — the ONE place in
  this Arc's own code that is legitimately Nostr-wire-aware, exactly
  as `NostrPublicIdentityReader` (Alpha 103) was legitimately
  Nostr-specific internally while conforming to a protocol-neutral
  interface.
- Both implementations reject (throw) when not connected — a
  transport-level failure, not an ACK-shaped one; `publish()` never
  silently no-ops and never auto-reconnects.
- `NullRelay` gains a `published: readonly FedosEventDescriptor[]`
  getter, backed by a private array, for test observability — still
  zero real networking.

## 3. Responsibility boundary

- **Transport only:** `publish()` sends; it does not confirm, retry,
  or interpret any relay response.
- **No ACK vocabulary:** neither implementation's own `publish()`
  return type, nor `FedosRelay.publish()`'s own signature, names an
  acceptance/rejection concept of any kind.
- **Event Foundation reused, not redesigned:** `FedosEventDescriptor`
  is imported unchanged; no field is added, renamed, or removed by
  this Stage.
- **Connection required:** `publish()` on either implementation
  requires a prior, still-open `connect()` — this Arc's own
  Alpha 217 Verification exercises this contract directly.

## 4. What this Stage does NOT do

- Does **not** add a `PublishResult`, `accepted`, `message`, or any
  other ACK-shaped type — this Arc's own "No ACK handling" instruction
  is honored throughout.
- Does **not** add any new file — this Stage edits three existing
  files only.
- Does **not** modify `src/desktop/fedos_event_descriptor.ts`,
  `desktop_application.ts`, or `create_desktop_application.ts`.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.
- Does **not** implement REQ, CLOSE, Subscription, Filters, or a Relay
  Pool of any kind.

## 5. See also

- `docs/secure_runtime_alpha_215_connection_lifecycle.md`
- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_103_source_injection.md`

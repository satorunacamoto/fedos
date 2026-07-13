/**
 * Secure Runtime Alpha 213 ("Null Relay") — the FIRST implementation
 * of `FedosRelay` (`fedos_relay.ts`, Alpha 212) anywhere in this
 * repository, mirroring the exact relationship `NullEventReader`
 * (`null_event_reader.ts`, Alpha 203) already has to `FedosEventReader`:
 * a dependency-free implementation, holding nothing but the connection
 * target itself, since `FedosRelay` (as of this Stage) names nothing
 * beyond that target. No networking of any kind exists in this file —
 * there is, as yet, no method on the interface THIS Stage's own
 * `NullRelay` could even open a network connection through.
 *
 * Secure Runtime Alpha 214 ("WebSocket Relay — Connection Only") adds
 * a new private field, `#connected: boolean` (initial `false`), and a
 * new public method, `connect(): Promise<void>`, whose own entire body
 * sets `#connected = true` — the ONLY change this Stage makes.
 * `NullRelay` still opens NO real network connection of any kind —
 * `#connected` is plain in-memory call-history bookkeeping, kept in
 * lockstep with `FedosRelay`'s own newly-added `connect()` method so
 * `NullRelay` remains a behaviorally faithful (though non-networked)
 * stand-in for `WebSocketRelay` (`websocket_relay.ts`, Alpha 214, the
 * SAME Stage's other new file) in tests.
 *
 * Secure Runtime Alpha 215 ("Connection Lifecycle") adds two new
 * public methods, `disconnect(): Promise<void>` (sets `#connected =
 * false`) and `isConnected(): boolean` (returns `#connected`) — the
 * ONLY change this Stage makes. Both are PURE reads/writes of the
 * SAME `#connected` field Alpha 214 already introduced — no new
 * field, no network reference of any kind.
 *
 * Secure Runtime Alpha 216 ("Publish API") adds a new private field,
 * `#published: FedosEventDescriptor[]` (initial `[]`), a new public
 * getter, `published: readonly FedosEventDescriptor[]`, and a new
 * public method, `publish(event: FedosEventDescriptor): Promise<void>`
 * — the ONLY change this Stage makes. `publish()` REJECTS (throws)
 * when `#connected` is `false` — the SAME "transport requires an open
 * connection" contract `WebSocketRelay.publish()`
 * (`websocket_relay.ts`, Alpha 216) enforces for real, so both
 * implementations remain behaviorally interchangeable. On success, the
 * event is appended to `#published` — plain in-memory bookkeeping,
 * never a network send of any kind — and the returned `Promise`
 * resolves with no value, matching `FedosRelay.publish()`'s own
 * `Promise<void>` contract exactly (no ACK, no result object).
 *
 * HARD GUARDRAILS:
 *   - `NullRelay` is the ONLY export.
 *   - The constructor takes exactly ONE argument, `url: string`, and
 *     performs NO async work of any kind.
 *   - `#connected` (Alpha 214) is PLAIN in-memory state — never backed
 *     by a real socket, `fetch`, or any other network primitive.
 *   - `connect()` (Alpha 214) NEVER throws and performs NO network
 *     I/O of any kind — its own entire body is a single field
 *     assignment.
 *   - `disconnect()` (Alpha 215) NEVER throws — its own entire body is
 *     a single field assignment, `#connected = false`, regardless of
 *     whether `connect()` was ever called first.
 *   - `isConnected()` (Alpha 215) is a PURE, SYNCHRONOUS WRAPPER — its
 *     own entire body is `return this.#connected;`, nothing more.
 *   - `publish()` (Alpha 216) throws when `!#connected`, and otherwise
 *     ONLY appends to `#published` — no network I/O, no ACK, no result
 *     object of any kind.
 *   - `published` (Alpha 216) is a `readonly` getter — no method on
 *     this class allows external code to clear or splice the recorded
 *     list.
 *   - NO `WebSocket`, `fetch`, or network reference of any kind.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";
import type { FedosRelay } from "./fedos_relay.js";

export class NullRelay implements FedosRelay {
  readonly url: string;
  #connected: boolean = false;
  #published: FedosEventDescriptor[] = [];

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    this.#connected = true;
  }

  async disconnect(): Promise<void> {
    this.#connected = false;
  }

  isConnected(): boolean {
    return this.#connected;
  }

  get published(): readonly FedosEventDescriptor[] {
    return this.#published;
  }

  async publish(event: FedosEventDescriptor): Promise<void> {
    if (!this.#connected) {
      throw new Error("FedosRelay.publish() called while not connected.");
    }
    this.#published.push(event);
  }
}

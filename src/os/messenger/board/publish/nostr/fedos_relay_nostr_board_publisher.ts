/**
 * Secure Runtime Alpha 456 ("FedosRelayNostrBoardPublisher —
 * publishOne") and Alpha 457 ("publishBatch") — Stages 6–7 of the Alpha
 * 451–460 Canonical Nostr Outbound Publisher Foundation Arc.
 * `FedosRelayNostrBoardPublisher` is the ONE concrete implementation of
 * `FedosNostrBoardPublisher` (`./fedos_nostr_board_publisher.ts`, Alpha
 * 455) this Arc builds, mirroring `FedosWasmNostrSigningAuthority`'s
 * own identical relationship to `FedosNostrSigningAuthority`
 * (`src/nostr/sign/`, Alpha 445) — an interface file naming the
 * contract, a SEPARATE file naming the one real implementation, never
 * merged into a single file.
 *
 * Secure Runtime Alpha 456's own entire scope: `publishOne()`. Its own
 * entire body: reject the entry closed (`return false`, NEVER throw)
 * when `entry.intent.target.protocol !== "nostr"` — a cross-protocol
 * pairing is a caller error this Publisher refuses to transport, never
 * silently reroutes; otherwise convert `entry.event` via
 * `nostrWireEventToFedosEventDescriptor` (`./fedos_nostr_wire_event_to_event_descriptor.ts`,
 * Alpha 454, UNCHANGED) and call `this.#relay.publish(descriptor)`
 * EXACTLY ONCE. `FedosRelay.publish()` (Alpha 216, UNCHANGED) already
 * throws when the Relay is not connected — this method does not
 * duplicate that `isConnected()` check; it only wraps the ONE call in
 * `try`/`catch` and reports the outcome as a boolean, never
 * re-attempting, never inspecting the thrown error's own message.
 *
 * Secure Runtime Alpha 457's own entire scope: `publishBatch()`. Its
 * own entire body: a plain sequential `for` loop calling `publishOne()`
 * once per entry and collecting each boolean result, in input order —
 * deliberately NOT `Promise.all` (no concurrency Pool of any kind, this
 * Arc's own absolute prohibition), and deliberately NOT short-circuiting
 * on the first `false` (one entry's failure must never suppress an
 * independent entry's own publish attempt — each entry is transported
 * exactly once, regardless of any other entry's outcome).
 *
 * HARD GUARDRAILS:
 *   - `FedosRelayNostrBoardPublisher` is the ONLY export.
 *   - The constructor takes exactly ONE argument, `relay: FedosRelay`,
 *     and performs NO async work of any kind — it only stores it.
 *   - `publishOne()` calls `this.#relay.publish(...)` AT MOST ONCE per
 *     invocation — no retry loop, no backoff delay, no second attempt
 *     of any kind.
 *   - `publishOne()` NEVER throws — every failure path (protocol
 *     mismatch, a thrown/rejected `relay.publish()`) resolves to
 *     `false`.
 *   - `publishBatch()` calls `publishOne()` SEQUENTIALLY (one `await`
 *     per loop iteration) — no `Promise.all`, no worker pool, no
 *     concurrency limit configuration of any kind.
 *   - NO delivery-observation field, NO OK/ACK correlation, NO retry
 *     count, NO backoff delay, anywhere in this file.
 *   - NO reference to ActivityPub, AT Protocol, Session, Ontology, or
 *     `p2p/` anywhere in this file.
 */

import type { FedosRelay } from "../../../desktop/fedos_relay.js";
import type {
  FedosNostrBoardPublishEntry,
  FedosNostrBoardPublisher,
} from "./fedos_nostr_board_publisher.js";
import { nostrWireEventToFedosEventDescriptor } from "./fedos_nostr_wire_event_to_event_descriptor.js";

export class FedosRelayNostrBoardPublisher implements FedosNostrBoardPublisher {
  readonly #relay: FedosRelay;

  constructor(relay: FedosRelay) {
    this.#relay = relay;
  }

  async publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean> {
    if (entry.intent.target.protocol !== "nostr") {
      return false;
    }
    const descriptor = nostrWireEventToFedosEventDescriptor(entry.event);
    try {
      await this.#relay.publish(descriptor);
      return true;
    } catch {
      return false;
    }
  }

  async publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const entry of entries) {
      results.push(await this.publishOne(entry));
    }
    return results;
  }
}

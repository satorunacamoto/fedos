/**
 * Secure Runtime Alpha 710 ("Transport Success vs Relay Acceptance") /
 * Alpha 711 ("Relay OK Correlation Decision") — Stages 10–11 of Phase B
 * of the Alpha 681–720 Arc.
 *
 * `FedosRelayNostrBoardPublisher` (`./fedos_relay_nostr_board_publisher.ts`,
 * Alpha 456/457) is explicitly frozen — its own header forbids adding OK/
 * ACK correlation to that file. Alpha 710 found this codebase's existing
 * `FedosRelay` foundation (Alpha 236/238) ALREADY ships a relay-wide
 * `onRelayMessage()` listener delivering parsed `["OK", ...]`/`["NOTICE",
 * ...]` messages — built for the Relay Message Reception Arc, never wired
 * into the Publish pipeline. This file is the small, additive correlation
 * Alpha 711 asks for, reusing that EXISTING primitive; `FedosRelay`/
 * `WebSocketRelay` themselves are untouched.
 *
 * `FedosNostrBoardPublisher.publishOne(): Promise<boolean>` (Alpha 455)
 * remains the exact, frozen interface — this class is a SECOND
 * implementation of it, never a widened contract. Its own `true` is a
 * STRICTLY STRONGER guarantee than `FedosRelayNostrBoardPublisher`'s own
 * `true` (local send succeeded only): here, `true` means a matching
 * `["OK", eventId, true, ...]` was actually observed from the Relay.
 * `false` covers every other case uniformly (transport failure, `OK
 * accepted=false`, or timeout) — Alpha 455's own "false covers every
 * failure path uniformly" contract is honored unchanged; this class does
 * NOT surface a separate "rejected" outcome through `publishOne()`'s own
 * boolean return (doing so would require widening a frozen interface —
 * Alpha 712's own "if canonical vocabulary must change, stop and perform
 * a formal ripple review" caution applies, and no such review was
 * performed this Arc).
 *
 * Correlation semantics (Alpha 711):
 *   - keyed by the event's own deterministic NIP-01 `id` (never a
 *     Relay-issued token).
 *   - ONE relay-wide `onRelayMessage()` listener, registered once at
 *     construction (never per-publish — matches `FedosRelay`'s own "one
 *     Relay-level listener" design, Alpha 238).
 *   - a matching `accepted: true` OK resolves `true`.
 *   - a matching `accepted: false` OK resolves `false` (a real rejection,
 *     collapsed into the same boolean `false` `publishOne()` already
 *     returns for every other failure).
 *   - an unrelated event id's OK is ignored (the pending map simply has
 *     no entry for it).
 *   - a `NOTICE` is never treated as a result for any pending publish.
 *   - a bounded timeout resolves `false` and removes the pending entry —
 *     covering a disconnected/stale Relay that will never send a
 *     matching OK.
 *   - a duplicate OK for an already-settled event id is a no-op (the
 *     pending entry no longer exists once first resolved).
 *   - the pending entry is ALWAYS removed once settled, on every path —
 *     no listener/map leak across calls.
 *
 * No Relay Pool, no reconnect logic, no new dependency.
 */

import type { FedosRelay } from "../../../desktop/fedos_relay.js";
import type {
  FedosNostrBoardPublishEntry,
  FedosNostrBoardPublisher,
} from "./fedos_nostr_board_publisher.js";
import { nostrWireEventToFedosEventDescriptor } from "./fedos_nostr_wire_event_to_event_descriptor.js";

const DEFAULT_OK_CORRELATION_TIMEOUT_MS = 10_000;

export class FedosRelayOkCorrelatedNostrBoardPublisher implements FedosNostrBoardPublisher {
  readonly #relay: FedosRelay;
  readonly #timeoutMs: number;
  readonly #pending = new Map<string, (accepted: boolean) => void>();

  constructor(relay: FedosRelay, timeoutMs: number = DEFAULT_OK_CORRELATION_TIMEOUT_MS) {
    this.#relay = relay;
    this.#timeoutMs = timeoutMs;
    this.#relay.onRelayMessage((message) => {
      if (message.kind !== "ok") return; // NOTICE is never a result.
      const resolve = this.#pending.get(message.eventId);
      if (resolve === undefined) return; // Unrelated (or already-settled/duplicate) OK — ignored.
      this.#pending.delete(message.eventId);
      resolve(message.accepted);
    });
  }

  async publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean> {
    if (entry.intent.target.protocol !== "nostr") {
      return false;
    }
    const eventId = entry.event.id;
    const descriptor = nostrWireEventToFedosEventDescriptor(entry.event);

    const correlated = new Promise<boolean>((resolve) => {
      this.#pending.set(eventId, resolve);
    });
    const timedOut = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(eventId)) {
          resolve(false);
        }
      }, this.#timeoutMs);
      if (typeof timer === "object" && timer !== null && "unref" in timer) {
        (timer as { unref: () => void }).unref();
      }
    });

    try {
      await this.#relay.publish(descriptor);
    } catch {
      this.#pending.delete(eventId);
      return false;
    }

    return Promise.race([correlated, timedOut]);
  }

  async publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const entry of entries) {
      results.push(await this.publishOne(entry));
    }
    return results;
  }
}

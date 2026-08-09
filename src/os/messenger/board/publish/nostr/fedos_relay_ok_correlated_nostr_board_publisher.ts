/**
 * Secure Runtime Alpha 710 ("Transport Success vs Relay Acceptance") /
 * Alpha 711 ("Relay OK Correlation Decision") — Stages 10–11 of Phase B
 * of the Alpha 681–720 Arc. Extended by Secure Runtime Alpha 724
 * ("Matching OK Correlation Contract") — Stage 4 of the Alpha 721–740
 * Nostr Relay ACK Semantics & Permanent Rejection Arc.
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
 * remains the exact, frozen interface — `publishOne()` below is unchanged
 * in its own contract (`true` iff a matching `accepted: true` OK arrived;
 * `false` covers every other case uniformly, matching Alpha 455's own
 * "false covers every failure path uniformly" discipline).
 *
 * Alpha 721's own inventory found the ACTUAL defect this Arc closes: a
 * genuine `accepted: false` rejection had NO way to reach the canonical
 * `FedosOutboundPublishResult` (`../fedos_outbound_publish_result.js`,
 * Alpha 492, UNCHANGED) as `"rejected"` — collapsing through
 * `publishOne()`'s own boolean lost that distinction, and
 * `nostrPublishOneResultToOutboundPublishResult()` (Alpha 497, frozen)
 * can only ever produce `"accepted"`/`"failed"` from a boolean. This
 * class now ALSO implements `FedosNostrBoardPublisherWithOutcome`
 * (`./fedos_nostr_board_publisher_with_outcome.js`, Alpha 722/723) —
 * `publishOneOutcome()` returns the real three-way result directly,
 * sharing the SAME internal correlation logic `publishOne()` itself now
 * delegates to (`#correlate()`, below) — no duplicated timer/listener
 * logic, no behavior drift between the two entry points.
 *
 * Correlation contract (Alpha 724):
 *   - keyed by the event's own deterministic NIP-01 `id` (never a
 *     Relay-issued token) — exact match only.
 *   - `accepted: true` → `{ outcome: "accepted", externalReference: eventId }`.
 *   - `accepted: false` → `{ outcome: "rejected", externalReference: eventId }`
 *     — a REAL, terminal rejection (Alpha 728: never retried).
 *   - an unrelated event id's OK is ignored (the pending map simply has
 *     no entry for it).
 *   - a malformed OK never reaches this class at all —
 *     `parseRelayInboundMessage()` (`../../../desktop/relay_inbound_parser.ts`,
 *     UNCHANGED) already rejects any `"OK"` frame whose `accepted` field
 *     is not a real boolean before `onRelayMessage()` ever fires.
 *   - a `NOTICE` is never treated as a result for any pending publish.
 *   - a duplicate OK for an already-settled event id is a no-op (the
 *     first terminal result wins — the pending entry no longer exists
 *     once first resolved).
 *   - a stale/superseded listener callback cannot resolve a NEW publish
 *     attempt for the SAME event id, because `#pending` is keyed by a
 *     fresh `Map` entry per `#correlate()` call and any earlier entry for
 *     the identical key was already deleted on its own prior settlement
 *     path (accepted, rejected, or timeout) before a new attempt could
 *     ever register one.
 *   - a bounded timeout resolves `{ outcome: "failed", externalReference: null }`
 *     and removes the pending entry — covering a disconnected/stale
 *     Relay that will never send a matching OK (Alpha 728: `"failed"`
 *     remains retryable per the existing, unchanged policy).
 *   - the pending entry is ALWAYS removed once settled, on every path —
 *     no listener/map leak across calls (Alpha 730).
 *
 * No Relay Pool, no reconnect logic, no new dependency.
 */

import type { FedosRelay } from "../../../../../desktop/fedos_relay.js";
import type { FedosOutboundPublishResult } from "../fedos_outbound_publish_result.js";
import type {
  FedosNostrBoardPublishEntry,
  FedosNostrBoardPublisher,
} from "./fedos_nostr_board_publisher.js";
import type { FedosNostrBoardPublisherWithOutcome } from "./fedos_nostr_board_publisher_with_outcome.js";
import { nostrWireEventToFedosEventDescriptor } from "./fedos_nostr_wire_event_to_event_descriptor.js";

const DEFAULT_OK_CORRELATION_TIMEOUT_MS = 10_000;
const FAILED_RESULT: FedosOutboundPublishResult = { outcome: "failed", externalReference: null };

export class FedosRelayOkCorrelatedNostrBoardPublisher
  implements FedosNostrBoardPublisher, FedosNostrBoardPublisherWithOutcome
{
  readonly #relay: FedosRelay;
  readonly #timeoutMs: number;
  readonly #pending = new Map<string, (accepted: boolean) => void>();

  constructor(relay: FedosRelay, timeoutMs: number = DEFAULT_OK_CORRELATION_TIMEOUT_MS) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("FedosRelayOkCorrelatedNostrBoardPublisher: timeoutMs must be a positive integer.");
    }
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

  /** Alpha 724 -- the ONE correlation implementation both `publishOne()` and `publishOneOutcome()` share. */
  async #correlate(entry: FedosNostrBoardPublishEntry): Promise<FedosOutboundPublishResult> {
    if (entry.intent.target.protocol !== "nostr") {
      return FAILED_RESULT;
    }
    const eventId = entry.event.id;
    const descriptor = nostrWireEventToFedosEventDescriptor(entry.event);

    const correlated = new Promise<FedosOutboundPublishResult>((resolve) => {
      this.#pending.set(eventId, (accepted) => {
        resolve(
          accepted
            ? { outcome: "accepted", externalReference: eventId }
            : { outcome: "rejected", externalReference: eventId },
        );
      });
    });
    const timedOut = new Promise<FedosOutboundPublishResult>((resolve) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(eventId)) {
          resolve(FAILED_RESULT);
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
      return FAILED_RESULT;
    }

    return Promise.race([correlated, timedOut]);
  }

  async publishOneOutcome(entry: FedosNostrBoardPublishEntry): Promise<FedosOutboundPublishResult> {
    return this.#correlate(entry);
  }

  async publishOne(entry: FedosNostrBoardPublishEntry): Promise<boolean> {
    const result = await this.#correlate(entry);
    return result.outcome === "accepted";
  }

  async publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const entry of entries) {
      results.push(await this.publishOne(entry));
    }
    return results;
  }
}

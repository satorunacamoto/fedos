/**
 * Secure Runtime Alpha 1407/1408/1409 ("Publisher Adapter" / "Relay
 * Acceptance Semantics" / "Permanent Rejection") — Phase B of the Alpha
 * 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery Arc.
 *
 * A NEW, additive OK-correlation adapter over the EXISTING, unmodified
 * `FedosRelay` (`../../../desktop/fedos_relay.ts`, Alpha 216/236/238) —
 * mirrors `FedosRelayOkCorrelatedNostrBoardPublisher`'s own `#correlate()`
 * technique (`../../../board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`,
 * Alpha 710/711/724) field-for-field, since that class is typed to a
 * Board-specific `FedosNostrBoardPublishEntry` and cannot be reused
 * directly for a raw signed private-delivery event. No new correlation
 * IDEA is invented here — only the established one, re-applied.
 *
 * Keeps the SAME three-way distinction Alpha 1408 requires: Relay
 * `accepted: true` -> `"accepted"`; a genuine `accepted: false` -> a
 * TERMINAL `"rejected"` (Alpha 1409: never retried by this file — a
 * caller's own retry policy decides what to do with it, exactly like the
 * Board publish path); a bounded timeout / socket error -> a retryable
 * `"failed"`. Relay acceptance is NEVER conflated with recipient receipt
 * or recipient decryption (Alpha 1408's own explicit prohibition) — this
 * file has no visibility into either.
 */

import type { FedosRelay } from "../../../../../desktop/fedos_relay.js";
import type { FedosNostrWireEvent } from "../../../../../desktop/fedos_nostr_wire_event.js";
import { nostrWireEventToFedosEventDescriptor } from "../../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";

const DEFAULT_OK_CORRELATION_TIMEOUT_MS = 10_000;

export type FedosPrivateNostrDeliveryPublishOutcome = "accepted" | "rejected" | "failed";

export interface FedosPrivateNostrDeliveryPublisher {
  publish(event: FedosNostrWireEvent): Promise<FedosPrivateNostrDeliveryPublishOutcome>;
}

export class FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher implements FedosPrivateNostrDeliveryPublisher {
  readonly #relay: FedosRelay;
  readonly #timeoutMs: number;
  readonly #pending = new Map<string, (accepted: boolean) => void>();

  constructor(relay: FedosRelay, timeoutMs: number = DEFAULT_OK_CORRELATION_TIMEOUT_MS) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher: timeoutMs must be a positive integer.");
    }
    this.#relay = relay;
    this.#timeoutMs = timeoutMs;
    this.#relay.onRelayMessage((message) => {
      if (message.kind !== "ok") return; // NOTICE is never a result.
      const resolve = this.#pending.get(message.eventId);
      if (resolve === undefined) return; // Unrelated (or already-settled/duplicate) OK -- ignored.
      this.#pending.delete(message.eventId);
      resolve(message.accepted);
    });
  }

  async publish(event: FedosNostrWireEvent): Promise<FedosPrivateNostrDeliveryPublishOutcome> {
    const eventId = event.id;
    const descriptor = nostrWireEventToFedosEventDescriptor(event);

    const correlated = new Promise<FedosPrivateNostrDeliveryPublishOutcome>((resolve) => {
      this.#pending.set(eventId, (accepted) => resolve(accepted ? "accepted" : "rejected"));
    });
    const timedOut = new Promise<FedosPrivateNostrDeliveryPublishOutcome>((resolve) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(eventId)) resolve("failed");
      }, this.#timeoutMs);
      if (typeof timer === "object" && timer !== null && "unref" in timer) {
        (timer as { unref: () => void }).unref();
      }
    });

    try {
      await this.#relay.publish(descriptor);
    } catch {
      this.#pending.delete(eventId);
      return "failed";
    }

    return Promise.race([correlated, timedOut]);
  }
}

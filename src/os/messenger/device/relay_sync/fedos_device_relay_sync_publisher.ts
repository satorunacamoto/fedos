/**
 * Secure Runtime Alpha 3641–3720 ("Relay-Assisted Device Synchronization")
 * — the Device Sync Publisher (Phase D/H: outbound publish, per-Relay
 * outcome, multi-Relay fan-out).
 *
 * Mirrors `../../conversation/transport/relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.ts`'s
 * own private `RelayOkCorrelator` idiom EXACTLY — one `onRelayMessage`
 * listener registered per Relay, at CONSTRUCTION time (never per-publish,
 * which would leak an ever-growing listener — `FedosRelay` exposes no
 * `offRelayMessage`), correlated by the event's own NIP-01 `id`. This is a
 * NEW, small, Device-Sync-scoped copy of that idiom — not a modification
 * of the Conversation-domain file, and not a shared/generalized class —
 * matching this codebase's own already-twice-established "new parallel
 * implementation per domain" discipline (Board Outbox → Conversation
 * Outbox, neither ever generalized).
 *
 * UNLIKE the Conversation Publisher (which aggregates into ONE
 * `"delivered"|"rejected"|"failed"` outcome), this file returns the FULL,
 * PER-RELAY outcome array — Phase D/H's own explicit "record per-Relay
 * outcome" / "one Relay failure does not corrupt another result"
 * requirement — aggregation (if a caller wants one) is the caller's own
 * concern, kept deliberately out of this file to avoid re-deciding
 * Conversation's own "any-accept-wins" policy for a domain that may want a
 * different one.
 *
 * HARD GUARDRAILS:
 *   - No Relay Pool, no reconnect logic, no new `FedosRelay` implementation.
 *   - `publish()` never throws for a delivery-side problem — every Relay's
 *     own failure/timeout/rejection is captured as a per-Relay outcome.
 *   - Relay ACK means Relay acceptance ONLY — this file has no concept of,
 *     and never claims, target Device import.
 */

import type { FedosConversationRelaySet } from "../../../../conversation/transport/relay/fedos_conversation_relay_set.js";
import type { FedosRelay } from "../../../../desktop/fedos_relay.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosEventDescriptor } from "../../../../desktop/fedos_event_descriptor.js";
import { nostrWireEventToFedosEventDescriptor } from "../../../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";

const DEFAULT_OK_CORRELATION_TIMEOUT_MS = 10_000;

export type FedosDeviceRelaySyncPerRelayOutcome = "accepted" | "rejected" | "failed";

export interface FedosDeviceRelaySyncPublishOutcome {
  readonly relayUrl: string;
  readonly outcome: FedosDeviceRelaySyncPerRelayOutcome;
}

/** PRIVATE — one Relay's own permanent OK-correlation state, one instance per Relay in the set. See this file's own header for why a listener is registered once, at construction. */
class DeviceRelaySyncOkCorrelator {
  readonly #relay: FedosRelay;
  readonly #pending = new Map<string, (accepted: boolean) => void>();

  constructor(relay: FedosRelay) {
    this.#relay = relay;
    this.#relay.onRelayMessage((message) => {
      if (message.kind !== "ok") return;
      const resolve = this.#pending.get(message.eventId);
      if (resolve === undefined) return;
      this.#pending.delete(message.eventId);
      resolve(message.accepted);
    });
  }

  get url(): string {
    return this.#relay.url;
  }

  async correlate(eventId: string, descriptor: FedosEventDescriptor, timeoutMs: number): Promise<FedosDeviceRelaySyncPerRelayOutcome> {
    const correlated = new Promise<FedosDeviceRelaySyncPerRelayOutcome>((resolve) => {
      this.#pending.set(eventId, (accepted) => resolve(accepted ? "accepted" : "rejected"));
    });
    const timedOut = new Promise<FedosDeviceRelaySyncPerRelayOutcome>((resolve) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(eventId)) resolve("failed");
      }, timeoutMs);
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

/** Explicit Relay-count resource limit (Phase H) — no unbounded fan-out. */
export const FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS = 16;

export class FedosDeviceRelaySyncPublisher {
  readonly #correlators: readonly DeviceRelaySyncOkCorrelator[];
  readonly #timeoutMs: number;

  constructor(relaySet: FedosConversationRelaySet, timeoutMs: number = DEFAULT_OK_CORRELATION_TIMEOUT_MS) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("FedosDeviceRelaySyncPublisher: timeoutMs must be a positive integer.");
    }
    if (relaySet.relays.length > FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS) {
      throw new Error(`FedosDeviceRelaySyncPublisher: relay count exceeds the resource limit of ${FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS}.`);
    }
    this.#timeoutMs = timeoutMs;
    this.#correlators = relaySet.relays.map((relay) => new DeviceRelaySyncOkCorrelator(relay));
  }

  /** Publishes one already-signed event to every configured Relay, IN PARALLEL, returning the FULL per-Relay outcome array — one Relay's own failure/rejection never affects another's result. */
  async publish(event: FedosNostrWireEvent): Promise<readonly FedosDeviceRelaySyncPublishOutcome[]> {
    const descriptor = nostrWireEventToFedosEventDescriptor(event);
    return Promise.all(
      this.#correlators.map(async (correlator) => ({
        relayUrl: correlator.url,
        outcome: await correlator.correlate(event.id, descriptor, this.#timeoutMs),
      })),
    );
  }
}

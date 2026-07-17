/**
 * Secure Runtime Alpha 1471–1540 — Multiple Relay fan-out's Publisher.
 *
 * Implements `FedosConversationTransportPublisher`
 * (`../fedos_conversation_transport_publisher.ts`) over a
 * `FedosConversationRelaySet` (N `FedosRelay` instances). For each
 * `publish()` call: resolves the already-signed event via the injected
 * `FedosConversationTransportSignedEventSourceFn`
 * (`../fedos_conversation_transport_signed_event_source.ts`'s own
 * `resolveSignedEvent`), maps it to a `FedosEventDescriptor`
 * (`nostrWireEventToFedosEventDescriptor`,
 * `../../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts`,
 * Alpha 454, UNCHANGED — reused verbatim, not reimplemented), then runs
 * the SAME per-relay `onRelayMessage` OK-correlation idiom
 * `FedosRelayOkCorrelatedNostrBoardPublisher`
 * (`../../../board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`,
 * Alpha 710/711/724) already established, once per relay, IN PARALLEL.
 *
 * Listener registration mirrors that file's own discipline EXACTLY: ONE
 * `onRelayMessage` listener is registered per relay, at CONSTRUCTION
 * time — never one per `publish()` call, which would leak an
 * ever-growing, permanently-live listener on every relay across the
 * lifetime of a long-running transport (`FedosRelay` exposes no
 * `offRelayMessage`/unsubscribe-listener method, Alpha 236/238's own
 * frozen shape). Each relay owns its own `#pending` map, keyed by the
 * event's own deterministic NIP-01 `id` — an unrelated or
 * already-settled event id's OK is ignored, the identical "duplicate OK
 * is a no-op" guarantee Alpha 724 already established.
 *
 * Aggregation policy (this arc's own "any-accept-wins" decision, named
 * explicitly rather than left implicit):
 *   - `"delivered"` if ANY relay's own correlation accepts.
 *   - `"rejected"` only if EVERY relay explicitly rejected (a real,
 *     terminal `accepted: false` OK from every one of them) — retried
 *     `"never"` again, mirroring Alpha 728's own "a real rejection is
 *     never retried" precedent.
 *   - otherwise `"failed"`, retried `"later"` — covers any mix of
 *     timeout/transport failure with at most a partial rejection.
 *
 * HARD GUARDRAILS:
 *   - No Relay Pool, no reconnect logic, no new Relay implementation.
 *   - `publish()` never throws for a delivery-side problem.
 */

import type {
  FedosConversationTransportPublisher,
  FedosConversationTransportPublishResult,
} from "../fedos_conversation_transport_publisher.js";
import type { FedosPersistedConversationTransportOutboxRecordV1 } from "../fedos_conversation_transport_outbox_codec.js";
import type { FedosConversationRelaySet } from "./fedos_conversation_relay_set.js";
import type { FedosRelay } from "../../../desktop/fedos_relay.js";
import type { FedosNostrWireEvent } from "../../../desktop/fedos_nostr_wire_event.js";
import type { FedosEventDescriptor } from "../../../desktop/fedos_event_descriptor.js";
import { nostrWireEventToFedosEventDescriptor } from "../../../board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";

export type FedosConversationTransportSignedEventSourceFn = (
  record: FedosPersistedConversationTransportOutboxRecordV1,
) => Promise<FedosNostrWireEvent | null>;

const DEFAULT_OK_CORRELATION_TIMEOUT_MS = 10_000;
const NO_EVENT_YET_RESULT: FedosConversationTransportPublishResult = { outcome: "failed", retryPolicy: "later" };

type SingleRelayOutcome = "accepted" | "rejected" | "failed";

/** PRIVATE — one relay's own permanent OK-correlation state, mirroring `FedosRelayOkCorrelatedNostrBoardPublisher`'s own `#pending` map exactly, one instance per relay in the set. */
class RelayOkCorrelator {
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

  async correlate(eventId: string, descriptor: FedosEventDescriptor, timeoutMs: number): Promise<SingleRelayOutcome> {
    const correlated = new Promise<SingleRelayOutcome>((resolve) => {
      this.#pending.set(eventId, (accepted) => resolve(accepted ? "accepted" : "rejected"));
    });
    const timedOut = new Promise<SingleRelayOutcome>((resolve) => {
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

export class FedosMultiRelayOkCorrelatedConversationTransportPublisher implements FedosConversationTransportPublisher {
  readonly #eventSource: FedosConversationTransportSignedEventSourceFn;
  readonly #timeoutMs: number;
  readonly #correlators: readonly RelayOkCorrelator[];

  constructor(
    relaySet: FedosConversationRelaySet,
    eventSource: FedosConversationTransportSignedEventSourceFn,
    timeoutMs: number = DEFAULT_OK_CORRELATION_TIMEOUT_MS,
  ) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("FedosMultiRelayOkCorrelatedConversationTransportPublisher: timeoutMs must be a positive integer.");
    }
    this.#eventSource = eventSource;
    this.#timeoutMs = timeoutMs;
    // ONE correlator per relay, constructed HERE -- registers exactly one
    // permanent onRelayMessage listener per relay for this Publisher's
    // own lifetime. See this file's own header for why this must never
    // happen per-publish().
    this.#correlators = relaySet.relays.map((relay) => new RelayOkCorrelator(relay));
  }

  async publish(
    record: FedosPersistedConversationTransportOutboxRecordV1,
  ): Promise<FedosConversationTransportPublishResult> {
    const event = await this.#eventSource(record);
    if (event === null) return NO_EVENT_YET_RESULT;

    const descriptor = nostrWireEventToFedosEventDescriptor(event);

    const outcomes = await Promise.all(
      this.#correlators.map((correlator) => correlator.correlate(event.id, descriptor, this.#timeoutMs)),
    );

    if (outcomes.some((outcome) => outcome === "accepted")) {
      return { outcome: "delivered", retryPolicy: "never" };
    }
    if (outcomes.every((outcome) => outcome === "rejected")) {
      return { outcome: "rejected", retryPolicy: "never" };
    }
    return { outcome: "failed", retryPolicy: "later" };
  }
}

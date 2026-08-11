/**
 * Secure Runtime Alpha 496 ("Publisher Adapter") — Stage 6 of the Alpha
 * 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * `FedosNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher`
 * (`../../outbox/fedos_board_outbox_publisher.js`, Alpha 473, UNCHANGED)
 * — lets the ALREADY-BUILT `FedosRelayNostrBoardPublisher` (Alpha
 * 456/457, UNCHANGED, injected here only via the `FedosNostrBoardPublisher`
 * INTERFACE, Alpha 455) serve `FedosPublishScheduler` (Alpha 476,
 * UNCHANGED) without either side being rewritten. See
 * `docs/secure_runtime_alpha_496_publisher_adapter.md` for the full
 * design record, including why a second injected dependency
 * (`eventSource`) is unavoidable and why it is never a signing
 * implementation.
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrBoardPublisherAdapter` and
 *     `FedosNostrBoardPublisherAdapterEventSource` are the ONLY
 *     exports.
 *   - No import of `FedosPublishScheduler`, either Observation
 *     vocabulary, `FedosBoardOutboxPersistence`, any Board
 *     Repository/Reader, or `FedosNostrSigningAuthority` — this file
 *     never schedules, never observes, never deletes an Outbox intent,
 *     never touches the Board, and never signs.
 *   - `publish()` calls `this.#publisher.publishOne(...)` AT MOST ONCE
 *     per invocation — no retry loop of any kind.
 *   - `publish()` NEVER throws — every failure path (malformed record,
 *     non-`"nostr"` target, no available signed event, a `false` send
 *     result) resolves to a well-formed `FedosBoardOutboxPublishResult`.
 */

import type { FedosPersistedBoardOutboxRecordV1 } from "../../outbox/fedos_board_outbox_codec.js";
import { deserializeFedosBoardOutboxIntent } from "../../outbox/fedos_board_outbox_codec.js";
import type {
  FedosBoardOutboxPublisher,
  FedosBoardOutboxPublishResult,
} from "../../outbox/fedos_board_outbox_publisher.js";
import type { FedosNostrBoardPublisher } from "./fedos_nostr_board_publisher.js";
import type { FedosNostrWireEvent } from "../../../desktop/fedos_nostr_wire_event.js";
import { nostrPublishOneResultToOutboundPublishResult } from "./fedos_nostr_publish_result_to_outbound_publish_result.js";
import { outboundPublishResultToFedosBoardOutboxPublishResult } from "../fedos_outbound_publish_result_to_board_outbox_publish_result.js";

/** Resolves an already-signed event for `record`, or `null` if none is available yet. Never signs. */
export type FedosNostrBoardPublisherAdapterEventSource = (
  record: FedosPersistedBoardOutboxRecordV1,
) => Promise<FedosNostrWireEvent | null>;

const NON_NOSTR_TARGET_RESULT: FedosBoardOutboxPublishResult = { outcome: "failed", retryPolicy: "never" };
const NO_EVENT_YET_RESULT: FedosBoardOutboxPublishResult = { outcome: "failed", retryPolicy: "later" };

export class FedosNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher {
  readonly #publisher: FedosNostrBoardPublisher;
  readonly #eventSource: FedosNostrBoardPublisherAdapterEventSource;

  constructor(publisher: FedosNostrBoardPublisher, eventSource: FedosNostrBoardPublisherAdapterEventSource) {
    this.#publisher = publisher;
    this.#eventSource = eventSource;
  }

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    const intent = deserializeFedosBoardOutboxIntent(record);
    if (intent === null || intent.target.protocol !== "nostr") {
      return NON_NOSTR_TARGET_RESULT;
    }

    const event = await this.#eventSource(record);
    if (event === null) {
      return NO_EVENT_YET_RESULT;
    }

    const success = await this.#publisher.publishOne({ intent, event });
    const canonical = nostrPublishOneResultToOutboundPublishResult(success, event);
    return outboundPublishResultToFedosBoardOutboxPublishResult(canonical);
  }
}

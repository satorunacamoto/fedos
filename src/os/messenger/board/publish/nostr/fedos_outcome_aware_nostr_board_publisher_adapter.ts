/**
 * Secure Runtime Alpha 723 ("Publisher Port Reconciliation") — Stage 3 of
 * the Alpha 721–740 Arc.
 *
 * `FedosOutcomeAwareNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher`
 * (`../../outbox/fedos_board_outbox_publisher.js`, Alpha 473, UNCHANGED)
 * — the Scheduler-facing port receives the canonical
 * `FedosOutboundPublishResult` DIRECTLY from
 * `FedosNostrBoardPublisherWithOutcome.publishOneOutcome()`
 * (`./fedos_nostr_board_publisher_with_outcome.js`, Alpha 722/723),
 * mapped via the EXISTING, unchanged
 * `outboundPublishResultToFedosBoardOutboxPublishResult()`
 * (`../fedos_outbound_publish_result_to_board_outbox_publish_result.js`,
 * Alpha 497) — never through the lossy boolean
 * `nostrPublishOneResultToOutboundPublishResult()` path
 * `FedosNostrBoardPublisherAdapter` (Alpha 496, UNCHANGED, still used by
 * the older, transport-only `FedosRelayNostrBoardPublisher`) necessarily
 * uses.
 *
 * This is a NEW, SIBLING adapter — `FedosNostrBoardPublisherAdapter`
 * itself is not modified. A Local Runtime wiring a
 * `FedosRelayOkCorrelatedNostrBoardPublisher` for real Relay-ACK-aware
 * delivery should use THIS adapter instead, so a genuine Relay rejection
 * reaches the Scheduler as `"rejected"` (never retried, Alpha 728) rather
 * than being collapsed into `"failed"` (retried like a transient error).
 *
 * HARD GUARDRAILS (mirroring Alpha 496's own, unchanged):
 *   - `FedosOutcomeAwareNostrBoardPublisherAdapter` is the ONLY export.
 *   - No import of `FedosPublishScheduler`, Observation vocabulary,
 *     `FedosBoardOutboxPersistence`, any Board Repository/Reader, or
 *     `FedosNostrSigningAuthority` — this file never schedules, never
 *     observes, never deletes an Outbox intent, never touches the
 *     Board, and never signs.
 *   - `publish()` calls `this.#publisher.publishOneOutcome(...)` AT MOST
 *     ONCE per invocation — no retry loop of any kind.
 *   - `publish()` NEVER throws — every failure path (malformed record,
 *     non-`"nostr"` target, no available signed event) resolves to a
 *     well-formed `FedosBoardOutboxPublishResult`.
 */

import type { FedosPersistedBoardOutboxRecordV1 } from "../../outbox/fedos_board_outbox_codec.js";
import { deserializeFedosBoardOutboxIntent } from "../../outbox/fedos_board_outbox_codec.js";
import type {
  FedosBoardOutboxPublisher,
  FedosBoardOutboxPublishResult,
} from "../../outbox/fedos_board_outbox_publisher.js";
import type { FedosNostrBoardPublisherWithOutcome } from "./fedos_nostr_board_publisher_with_outcome.js";
import type { FedosNostrBoardPublisherAdapterEventSource } from "./fedos_nostr_board_publisher_adapter.js";
import { outboundPublishResultToFedosBoardOutboxPublishResult } from "../fedos_outbound_publish_result_to_board_outbox_publish_result.js";

const NON_NOSTR_TARGET_RESULT: FedosBoardOutboxPublishResult = { outcome: "failed", retryPolicy: "never" };
const NO_EVENT_YET_RESULT: FedosBoardOutboxPublishResult = { outcome: "failed", retryPolicy: "later" };

export class FedosOutcomeAwareNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher {
  readonly #publisher: FedosNostrBoardPublisherWithOutcome;
  readonly #eventSource: FedosNostrBoardPublisherAdapterEventSource;

  constructor(publisher: FedosNostrBoardPublisherWithOutcome, eventSource: FedosNostrBoardPublisherAdapterEventSource) {
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

    const canonical = await this.#publisher.publishOneOutcome({ intent, event });
    return outboundPublishResultToFedosBoardOutboxPublishResult(canonical);
  }
}

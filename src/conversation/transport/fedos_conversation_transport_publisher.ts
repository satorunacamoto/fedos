/**
 * Secure Runtime Alpha 1471–1540 — the Mailbox/Ephemeral Delivery
 * publisher port.
 *
 * REUSES `FedosBoardOutboxPublishOutcome`/`FedosBoardOutboxRetryPolicy`/
 * `FedosBoardOutboxPublishResult`/`isValidFedosBoardOutboxPublishResult`
 * (`../../board/outbox/fedos_board_outbox_publisher.ts`, Alpha 473) BY
 * DIRECT IMPORT — this arc's own explicit "Reuse ... Publisher"
 * instruction, applied literally where the vocabulary is already fully
 * generic (`"delivered"|"rejected"|"failed"` / `"immediate"|"later"|"never"`
 * carry no Board-specific meaning). Only `publish()`'s own parameter type
 * differs (a transport-scoped record, never `FedosPersistedBoardOutboxRecordV1`)
 * — the Board Outbox Publisher file itself is never modified.
 *
 * HARD GUARDRAILS (mirrors Alpha 473 exactly):
 *   - No import from `../../nostr/*`, `../../desktop/*`, or any Relay/
 *     signing/transport file anywhere in THIS file (the relay-aware
 *     implementation lives in `./relay/`, a separate module).
 *   - `publish()` returns a RESULT — it never throws for a delivery-side
 *     problem.
 *   - `MockFedosConversationTransportPublisher` exists ONLY for tests —
 *     not wired to Nostr, ActivityPub, AT Protocol, or Session.
 */

import {
  isValidFedosBoardOutboxPublishResult,
  type FedosBoardOutboxPublishResult,
} from "../../board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedConversationTransportOutboxRecord } from "./fedos_conversation_transport_outbox_codec.js";

/** Reused, unchanged vocabulary — see this file's own header. */
export type FedosConversationTransportPublishResult = FedosBoardOutboxPublishResult;
export const isValidFedosConversationTransportPublishResult = isValidFedosBoardOutboxPublishResult;

export interface FedosConversationTransportPublisher {
  publish(record: FedosPersistedConversationTransportOutboxRecord): Promise<FedosConversationTransportPublishResult>;
}

export interface MockFedosConversationTransportPublisherOptions {
  readonly results?: readonly FedosConversationTransportPublishResult[];
  readonly next?: (
    record: FedosPersistedConversationTransportOutboxRecord,
    callIndex: number,
  ) => FedosConversationTransportPublishResult;
}

/** In-memory `FedosConversationTransportPublisher` for tests ONLY. Performs NO network, signing, or Relay call of any kind. */
export class MockFedosConversationTransportPublisher implements FedosConversationTransportPublisher {
  readonly #results: readonly FedosConversationTransportPublishResult[];
  readonly #next?: MockFedosConversationTransportPublisherOptions["next"];
  readonly #calls: FedosPersistedConversationTransportOutboxRecord[] = [];

  constructor(options: MockFedosConversationTransportPublisherOptions = {}) {
    this.#results = options.results ?? [];
    this.#next = options.next;
  }

  async publish(
    record: FedosPersistedConversationTransportOutboxRecord,
  ): Promise<FedosConversationTransportPublishResult> {
    const callIndex = this.#calls.length;
    this.#calls.push(record);
    const scripted = this.#results[callIndex];
    if (scripted !== undefined) return scripted;
    if (this.#next !== undefined) return this.#next(record, callIndex);
    return { outcome: "delivered", retryPolicy: "never" };
  }

  get calls(): readonly FedosPersistedConversationTransportOutboxRecord[] {
    return [...this.#calls];
  }
}

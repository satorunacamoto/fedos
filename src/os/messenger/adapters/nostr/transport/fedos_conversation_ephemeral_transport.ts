/**
 * Secure Runtime Alpha 1471–1540 — Ephemeral Delivery.
 *
 * The best-effort sibling to Mailbox Delivery
 * (`./fedos_conversation_transport_scheduler.ts`): ONE publish attempt,
 * ONE Observation `publishing → terminal` pair, and — the architectural
 * distinction that defines "ephemeral" — NO Outbox row is ever written
 * (`FedosConversationTransportOutboxPersistence` is never touched by this
 * file) and NO `FedosDeliveryRetryRegistry` is ever consulted: there is
 * no persisted intent for a future `tick()` to find and retry. A caller
 * that wants delivery to survive a process restart or a transient relay
 * failure uses Mailbox Delivery instead.
 *
 * REUSES the SAME `FedosConversationTransportPublisher` port Mailbox
 * Delivery uses — the identical envelope→ciphertext→route→sign→fan-out
 * pipeline (`FedosConversationTransportSignedEventSource` +
 * `FedosMultiRelayOkCorrelatedConversationTransportPublisher`) serves
 * both delivery modes; only the ORCHESTRATION around it differs. A
 * transient, never-persisted `FedosPersistedConversationTransportOutboxRecordV1`
 * is constructed in-memory ONLY to satisfy that shared Publisher
 * contract — `createFedosConversationTransportOutboxIntent()`/
 * `serializeFedosConversationTransportOutboxIntent()` (UNCHANGED) are
 * reused for this, never a second, parallel record shape.
 *
 * REUSES the canonical Observation vocabulary directly, keyed by the
 * envelope's own (never attempt-scoped — there is only ever one attempt)
 * `FedosDeliveryObservationSubjectId`.
 */

import {
  createFedosConversationTransportOutboxIntent,
  type FedosConversationTransportOutboxIntent,
} from "./fedos_conversation_transport_outbox_types.js";
import { serializeFedosConversationTransportOutboxIntent } from "./fedos_conversation_transport_outbox_codec.js";
import type { FedosConversationTransportPublisher, FedosConversationTransportPublishResult } from "./fedos_conversation_transport_publisher.js";
import { toFedosDeliveryObservationSubjectId } from "../../../board/observation/fedos_delivery_observation.js";
import type { FedosDeliveryObservationState } from "../../../board/observation/fedos_delivery_observation.js";
import type { FedosValidatingDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_write_validator.js";
import type { FedosConversationEnvelopeId } from "../../../conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";

export interface FedosConversationEphemeralSendRequest {
  readonly envelopeId: FedosConversationEnvelopeId;
  readonly conversationId: FedosConversationId;
  readonly publisher: FedosConversationTransportPublisher;
  readonly observationRepository: FedosValidatingDeliveryObservationRepository;
  readonly now?: () => number;
}

export type FedosConversationEphemeralSendOutcome =
  | FedosConversationTransportPublishResult
  | { readonly outcome: "invalid-input" };

export async function sendFedosConversationEphemeral(
  request: FedosConversationEphemeralSendRequest,
): Promise<FedosConversationEphemeralSendOutcome> {
  const now = request.now ?? Date.now;
  const createdAt = now();

  const intent: FedosConversationTransportOutboxIntent | null = createFedosConversationTransportOutboxIntent(
    request.envelopeId,
    request.conversationId,
    createdAt,
  );
  if (intent === null) return { outcome: "invalid-input" };

  const record = serializeFedosConversationTransportOutboxIntent(intent);

  const subjectId = toFedosDeliveryObservationSubjectId(intent.id);
  if (subjectId !== null) {
    request.observationRepository.record(subjectId, "publishing", now());
  }

  const result = await request.publisher.publish(record);

  if (subjectId !== null) {
    const state: FedosDeliveryObservationState =
      result.outcome === "delivered" ? "accepted" : result.outcome === "rejected" ? "rejected" : "failed";
    request.observationRepository.record(subjectId, state, now(), result.reason);
  }

  return result;
}

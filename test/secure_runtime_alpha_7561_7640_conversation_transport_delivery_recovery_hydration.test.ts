import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { createFedosConversationTransportOutboxIntent } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_types.js";
import { serializeFedosConversationTransportOutboxIntent } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_codec.js";
import { toFedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_attempt_subject_id.js";
import { hydrateFedosConversationTransportDeliveryRecoveryState } from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_delivery_recovery_hydration.js";

/**
 * Secure Runtime Alpha 7561-7640 -- "FedOS Conversation Outbox Restart
 * Hydration and Scheduler Scalability Arc": unit-level verification of
 * `hydrateFedosConversationTransportDeliveryRecoveryState()`, independent
 * of the full `FedosPrivateTransport` construction path (see the Alpha
 * 7561-7640 real vertical slice test for that). Mirrors
 * `secure_runtime_alpha_585_durable_retry_persistence_implementation.test.ts`'s
 * own structure and naming discipline exactly, narrowed to this
 * function's own two-field (`delivered`/`abandoned`) return shape.
 */

function makePipeline() {
  const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  const retryQuery = new FedosDeliveryRetryQuery(query);
  return { outboxPersistence, repository, query, validating, retryQuery };
}

function putIntent(outboxPersistence: InMemoryFedosConversationTransportOutboxPersistence, envelopeIdStr: string, conversationIdStr = "conv-7561") {
  const envelopeId = toFedosConversationEnvelopeId(envelopeIdStr)!;
  const conversationId = conversationIdStr as unknown as FedosConversationId;
  const intent = createFedosConversationTransportOutboxIntent(envelopeId, conversationId, 1)!;
  outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 7561-7640 -- Conversation Transport Delivery Recovery Hydration", () => {
  it("1. an intent with no recorded history is absent from every recovery bucket (treated as pending)", () => {
    const { outboxPersistence, retryQuery } = makePipeline();
    putIntent(outboxPersistence, "env-7561-1");
    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.size).toBe(0);
    expect(state.abandoned.size).toBe(0);
  });

  it("2. an intent whose latest recorded attempt is 'accepted' is recovered as delivered (Relay-accepted)", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-2");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "accepted", 2);

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("3. an intent whose latest recorded attempt is terminal-but-not-accepted (isFinal) is recovered as abandoned", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-3");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "rejected", 2, "final:policy-abandon");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.abandoned.has(intent.id)).toBe(true);
    expect(state.delivered.has(intent.id)).toBe(false);
  });

  it("4. an intent still mid-retry (terminal but not final) is neither delivered nor abandoned -- stays genuinely pending", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-4");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "failed", 2, "not-final:transient");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(false);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("5. an attempt still open ('publishing', no terminal write -- a mid-flight crash) leaves the intent pending, never misclassified", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-5");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    validating.record(attempt1, "publishing", 1); // no terminal write -- simulates a crash mid-attempt

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(false);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("6. a later attempt's outcome supersedes an earlier attempt's outcome for the SAME intent (retry-then-succeed)", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-6");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attempt1 = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    const attempt2 = makeFedosDeliveryAttemptSubjectId(subjectId, 2)!;
    validating.record(attempt1, "publishing", 1);
    validating.record(attempt1, "failed", 2, "not-final:transient");
    validating.record(attempt2, "publishing", 3);
    validating.record(attempt2, "accepted", 4);

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(intent.id)).toBe(true);
    expect(state.abandoned.has(intent.id)).toBe(false);
  });

  it("7. mixed history across many intents classifies each independently (delivered/abandoned/pending coexist correctly)", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const deliveredIntent = putIntent(outboxPersistence, "env-7561-7-delivered");
    const abandonedIntent = putIntent(outboxPersistence, "env-7561-7-abandoned");
    const pendingIntent = putIntent(outboxPersistence, "env-7561-7-pending");
    const neverAttemptedIntent = putIntent(outboxPersistence, "env-7561-7-never-attempted");

    const deliveredSubject = toFedosDeliveryObservationSubjectId(deliveredIntent.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(deliveredSubject, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(deliveredSubject, 1)!, "accepted", 2);

    const abandonedSubject = toFedosDeliveryObservationSubjectId(abandonedIntent.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(abandonedSubject, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(abandonedSubject, 1)!, "failed", 2, "final:unsupported-recipient");

    const pendingSubject = toFedosDeliveryObservationSubjectId(pendingIntent.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(pendingSubject, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(pendingSubject, 1)!, "failed", 2, "not-final:transient");

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(deliveredIntent.id)).toBe(true);
    expect(state.abandoned.has(abandonedIntent.id)).toBe(true);
    expect(state.delivered.has(pendingIntent.id)).toBe(false);
    expect(state.abandoned.has(pendingIntent.id)).toBe(false);
    expect(state.delivered.has(neverAttemptedIntent.id)).toBe(false);
    expect(state.abandoned.has(neverAttemptedIntent.id)).toBe(false);
    expect(state.delivered.size).toBe(1);
    expect(state.abandoned.size).toBe(1);
  });

  it("8. an empty Outbox hydrates to two empty sets, never throws", () => {
    const { outboxPersistence, retryQuery } = makePipeline();
    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.size).toBe(0);
    expect(state.abandoned.size).toBe(0);
  });

  it("9. a corrupt/unreadable per-subject history read does not throw and leaves that intent pending, without affecting other intents", () => {
    const { outboxPersistence, validating, retryQuery } = makePipeline();
    const okIntent = putIntent(outboxPersistence, "env-7561-9-ok");
    const brokenIntent = putIntent(outboxPersistence, "env-7561-9-broken");

    const okSubject = toFedosDeliveryObservationSubjectId(okIntent.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(okSubject, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(okSubject, 1)!, "accepted", 2);

    // Simulate a read failure specifically for the broken intent's own
    // history by making retryQuery.historyFor() throw only for its
    // subject id -- proves the per-intent try/catch in this Arc's own
    // hydration function (mirroring Board's historyForSafe()) isolates
    // the failure instead of propagating it and voiding the whole scan.
    const brokenSubject = toFedosDeliveryObservationSubjectId(brokenIntent.id)!;
    const originalHistoryFor = retryQuery.historyFor.bind(retryQuery);
    retryQuery.historyFor = (subjectId) => {
      if (subjectId === brokenSubject) throw new Error("simulated corrupt Observation read");
      return originalHistoryFor(subjectId);
    };

    const state = hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);
    expect(state.delivered.has(okIntent.id)).toBe(true);
    expect(state.delivered.has(brokenIntent.id)).toBe(false);
    expect(state.abandoned.has(brokenIntent.id)).toBe(false);
  });

  it("10. hydration performs zero writes to the Observation repository or the Outbox", () => {
    const { outboxPersistence, repository, validating, retryQuery } = makePipeline();
    const intent = putIntent(outboxPersistence, "env-7561-10");
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    validating.record(makeFedosDeliveryAttemptSubjectId(subjectId, 1)!, "publishing", 1);
    validating.record(makeFedosDeliveryAttemptSubjectId(subjectId, 1)!, "accepted", 2);

    const beforeObservationCount = repository.list().length;
    const beforeIntentCount = outboxPersistence.listIntents().length;

    hydrateFedosConversationTransportDeliveryRecoveryState(outboxPersistence, retryQuery);

    expect(repository.list().length).toBe(beforeObservationCount);
    expect(outboxPersistence.listIntents().length).toBe(beforeIntentCount);
  });
});

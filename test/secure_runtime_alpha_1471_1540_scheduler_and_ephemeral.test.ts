import { describe, it, expect } from "vitest";
import { FedosConversationTransportScheduler } from "../src/conversation/transport/fedos_conversation_transport_scheduler.js";
import { sendFedosConversationEphemeral } from "../src/conversation/transport/fedos_conversation_ephemeral_transport.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import {
  createFedosConversationTransportOutboxIntent,
} from "../src/conversation/transport/fedos_conversation_transport_outbox_types.js";
import { serializeFedosConversationTransportOutboxIntent } from "../src/conversation/transport/fedos_conversation_transport_outbox_codec.js";
import { MockFedosConversationTransportPublisher } from "../src/conversation/transport/fedos_conversation_transport_publisher.js";
import type { FedosConversationTransportPublishResult } from "../src/conversation/transport/fedos_conversation_transport_publisher.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryRegistry } from "../src/board/observation/fedos_delivery_retry_registry.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";

const ENVELOPE_ID = "e".repeat(32) as never;
const CONVERSATION_ID = "board-1::thread-1" as never;

function makeValidatingRepository() {
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  return { repository, validating: new FedosValidatingDeliveryObservationRepository(repository, query) };
}

describe("Secure Runtime Alpha 1471-1540 -- Mailbox Delivery Scheduler (Retry/Observation reuse)", () => {
  it("1. a delivered intent is recorded as accepted and never retried", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1)!;
    outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));

    const { repository, validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher({
      results: [{ outcome: "delivered", retryPolicy: "never" }],
    });
    const scheduler = new FedosConversationTransportScheduler({
      outboxPersistence,
      publisher,
      observationRepository: validating,
      intervalMs: 1000,
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.result.outcome).toBe("delivered");

    const states = repository.list().map((observation) => observation.state);
    expect(states).toContain("publishing");
    expect(states).toContain("accepted");

    // A second tick never re-attempts an already-delivered intent.
    const secondTick = await scheduler.tick();
    expect(secondTick).toHaveLength(0);
    expect(publisher.calls).toHaveLength(1);
  });

  it("2. a 'later' retryPolicy leaves the intent pending for the NEXT tick, each attempt gets its own attempt-scoped Observation subject", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1)!;
    outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));

    const { repository, validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher({
      results: [
        { outcome: "failed", retryPolicy: "later" },
        { outcome: "delivered", retryPolicy: "never" },
      ],
    });
    const retryRegistry = new FedosDeliveryRetryRegistry();
    const scheduler = new FedosConversationTransportScheduler({
      outboxPersistence,
      publisher,
      observationRepository: validating,
      intervalMs: 1000,
      retryRegistry,
    });

    await scheduler.tick();
    await scheduler.tick();
    expect(publisher.calls).toHaveLength(2);

    // Each attempt wrote its own publishing->terminal pair -- no
    // "invalid-transition" rejection ever occurred (a rejection would
    // silently short-circuit the validating repository's own write, so
    // this asserts the FULL expected count landed).
    expect(repository.list()).toHaveLength(4);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    expect(retryRegistry.currentAttemptCount(subjectId)).toBe(2); // one allocation per attempt, across both ticks
  });

  it("3. a 'never' retryPolicy abandons the intent -- never retried again", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1)!;
    outboxPersistence.putIntent(serializeFedosConversationTransportOutboxIntent(intent));

    const { validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher({
      results: [{ outcome: "rejected", retryPolicy: "never" }],
    });
    const scheduler = new FedosConversationTransportScheduler({
      outboxPersistence,
      publisher,
      observationRepository: validating,
      intervalMs: 1000,
    });

    await scheduler.tick();
    const second = await scheduler.tick();
    expect(second).toHaveLength(0);
    expect(publisher.calls).toHaveLength(1);
  });

  it("4. tick() is single-flight -- a second concurrent call returns the SAME in-flight promise", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const { validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher();
    const scheduler = new FedosConversationTransportScheduler({
      outboxPersistence,
      publisher,
      observationRepository: validating,
      intervalMs: 1000,
    });
    const first = scheduler.tick();
    const second = scheduler.tick();
    expect(first).toBe(second);
    await first;
  });

  it("5. constructor rejects a non-positive-integer intervalMs", () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const { validating } = makeValidatingRepository();
    expect(
      () =>
        new FedosConversationTransportScheduler({
          outboxPersistence,
          publisher: new MockFedosConversationTransportPublisher(),
          observationRepository: validating,
          intervalMs: 0,
        }),
    ).toThrow();
  });
});

describe("Secure Runtime Alpha 1471-1540 -- Ephemeral Delivery (best-effort, no Outbox/Retry Registry)", () => {
  it("1. sends once, records one publishing->terminal Observation pair, never touches the Outbox", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const { repository, validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher({
      results: [{ outcome: "delivered", retryPolicy: "never" } satisfies FedosConversationTransportPublishResult],
    });

    const outcome = await sendFedosConversationEphemeral({
      envelopeId: ENVELOPE_ID,
      conversationId: CONVERSATION_ID,
      publisher,
      observationRepository: validating,
    });

    expect(outcome).toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(publisher.calls).toHaveLength(1);
    expect(outboxPersistence.listIntents()).toHaveLength(0); // never written
    const states = repository.list().map((observation) => observation.state);
    expect(states).toEqual(["publishing", "accepted"]);
  });

  it("2. a failed send is observed as failed, with no retry ever attempted by this function itself", async () => {
    const { repository, validating } = makeValidatingRepository();
    const publisher = new MockFedosConversationTransportPublisher({
      results: [{ outcome: "failed", retryPolicy: "later" }],
    });

    const outcome = await sendFedosConversationEphemeral({
      envelopeId: ENVELOPE_ID,
      conversationId: CONVERSATION_ID,
      publisher,
      observationRepository: validating,
    });

    expect(outcome).toEqual({ outcome: "failed", retryPolicy: "later" });
    expect(publisher.calls).toHaveLength(1); // exactly one attempt -- no retry loop
    expect(repository.list().map((o) => o.state)).toEqual(["publishing", "failed"]);
  });
});

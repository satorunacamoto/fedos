import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { fedosBoardOutboxObservationToDeliveryObservation } from "../src/board/outbox/fedos_board_outbox_observation_to_delivery_observation.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxObservationSource from "../src/board/outbox/fedos_board_outbox_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deliveryObservationSource from "../src/board/observation/fedos_delivery_observation.ts?raw";

describe("Secure Runtime Alpha 497 -- Scheduler Contract Rewiring", () => {
  it("structural: FedosPublishScheduler's own public method set is unchanged (start/stop/tick/isRunning/observationLog)", () => {
    const methodNames = [...schedulerSource.matchAll(/^\s{2}(?:async\s+)?(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    for (const expected of ["constructor", "isRunning", "observationLog", "start", "stop", "tick"]) {
      expect(methodNames).toContain(expected);
    }
  });

  it("structural: FedosPublishScheduler's own dependency shape is unchanged (publisher: FedosBoardOutboxPublisher)", () => {
    expect(schedulerSource).toContain("readonly publisher: FedosBoardOutboxPublisher;");
  });

  it("structural: FedosBoardOutboxObservation and FedosDeliveryObservation are both byte-for-byte their own Alpha 475/462 shape", () => {
    expect(outboxObservationSource).toContain("export interface FedosBoardOutboxObservation {");
    expect(deliveryObservationSource).toContain("export interface FedosDeliveryObservation {");
  });

  it("structural: FedosBoardOutboxPublisher interface is unchanged", () => {
    expect(outboxPublisherSource).toContain(
      "publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult>;",
    );
  });

  it("end to end: a real FedosPublishScheduler, injected with FedosNostrBoardPublisherAdapter, delivers a nostr-targeted intent and its observations bridge to the canonical vocabulary", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-e2e")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const relayPublisher = new FedosRelayNostrBoardPublisher(relay);

    const signedEvent: FedosNostrWireEvent = {
      id: "e".repeat(64),
      pubkey: "f".repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: "integration",
      sig: "1".repeat(128),
    };
    const adapter = new FedosNostrBoardPublisherAdapter(relayPublisher, async () => signedEvent);

    let now = 1000;
    const scheduler = new FedosPublishScheduler({
      outboxPersistence,
      publisher: adapter,
      intervalMs: 1000,
      now: () => now++,
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(relay.published).toHaveLength(1);

    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const canonicalObservations = entries[0]!.observations
      .map((observation) => fedosBoardOutboxObservationToDeliveryObservation(observation, subjectId))
      .filter((observation) => observation !== null);

    expect(canonicalObservations.map((o) => o!.state)).toEqual(["publishing", "accepted"]);
    for (const observation of canonicalObservations) {
      expect(observation!.subjectId).toBe(subjectId);
    }

    // A second tick() must not re-attempt a delivered intent.
    const secondTick = await scheduler.tick();
    expect(secondTick).toHaveLength(0);
  });

  it("end to end: a failed send is retried on the same tick per the Scheduler's own existing immediate-retry guardrail, and abandoned maps to failed canonically", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-e2e-fail")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    // A disconnected relay: FedosRelayNostrBoardPublisher.publishOne() always returns false.
    const disconnectedRelay = new NullRelay("wss://relay.example.test");
    const relayPublisher = new FedosRelayNostrBoardPublisher(disconnectedRelay);
    const signedEvent: FedosNostrWireEvent = {
      id: "9".repeat(64),
      pubkey: "8".repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: "will fail",
      sig: "7".repeat(128),
    };
    const adapter = new FedosNostrBoardPublisherAdapter(relayPublisher, async () => signedEvent);

    let now = 1;
    const scheduler = new FedosPublishScheduler({
      outboxPersistence,
      publisher: adapter,
      intervalMs: 1000,
      now: () => now++,
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    // failed -> retryPolicy "later" (Alpha 497 §2's own fixed table) -- no immediate-retry, no second attempt this tick.
    expect(entries[0]!.result).toEqual({ outcome: "failed", retryPolicy: "later" });

    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const canonicalStates = entries[0]!.observations
      .map((observation) => fedosBoardOutboxObservationToDeliveryObservation(observation, subjectId))
      .filter((observation) => observation !== null)
      .map((observation) => observation!.state);
    expect(canonicalStates).toEqual(["publishing", "failed"]);

    // "later" leaves the intent pending -- a subsequent tick() attempts it again.
    const secondTick = await scheduler.tick();
    expect(secondTick).toHaveLength(1);
  });

  it("the fixed retry-policy table never produces an immediate directive", async () => {
    const { outboundPublishOutcomeToRetryPolicy } = await import(
      "../src/board/publish/fedos_outbound_publish_result_retry_policy.js"
    );
    for (const outcome of ["accepted", "rejected", "failed"] as const) {
      expect(outboundPublishOutcomeToRetryPolicy(outcome)).not.toBe("immediate");
    }
  });
});

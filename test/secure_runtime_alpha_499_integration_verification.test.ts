import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
import { isFedosOutboundPublishResult } from "../src/board/publish/fedos_outbound_publish_result.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { outboundPublishOutcomeToRetryPolicy } from "../src/board/publish/fedos_outbound_publish_result_retry_policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../src/os/messenger/board/outbox/fedos_board_outbox_observation_to_delivery_observation.ts?raw";

function makeObservationPipeline() {
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  return { repository, query, validating: new FedosValidatingDeliveryObservationRepository(repository, query) };
}

const sampleEvent: FedosNostrWireEvent = {
  id: "5".repeat(64),
  pubkey: "6".repeat(64),
  created_at: 1,
  kind: 1,
  tags: [],
  content: "integration-verification",
  sig: "4".repeat(128),
};

describe("Secure Runtime Alpha 499 -- Integration Verification", () => {
  it("1. queued and publishing observations are both legal and recordable", () => {
    const { validating } = makeObservationPipeline();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-1")!;
    expect(validating.record(subjectId, "queued", 1)).toBe("recorded");
    expect(validating.record(subjectId, "publishing", 2)).toBe("recorded");
  });

  it("2a. accepted result: a real FedosNostrBoardPublisherAdapter over a connected relay", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => sampleEvent);
    const postId = toFedosBoardPostId("post-accepted")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    const result = await adapter.publish(serializeFedosBoardOutboxIntent(intent));
    expect(result).toEqual({ outcome: "delivered", retryPolicy: "never" });
  });

  it("2b. failed result: a real FedosNostrBoardPublisherAdapter over a disconnected relay", async () => {
    const relay = new NullRelay("wss://relay.example.test"); // never connected
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => sampleEvent);
    const postId = toFedosBoardPostId("post-failed")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    const result = await adapter.publish(serializeFedosBoardOutboxIntent(intent));
    expect(result).toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("2c. rejected result: the canonical pathway exists and is exercised directly (the Nostr adapter itself never produces it -- Alpha 492 §5's own named limitation)", () => {
    const rejected = { outcome: "rejected" as const, externalReference: null };
    expect(isFedosOutboundPublishResult(rejected)).toBe(true);
    expect(outboundPublishOutcomeToRetryPolicy("rejected")).toBe("never");

    const { validating } = makeObservationPipeline();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-rejected")!;
    validating.record(subjectId, "publishing", 1);
    expect(validating.record(subjectId, "rejected", 2)).toBe("recorded");
  });

  it("3. invalid transition and stale terminal observation are both rejected", () => {
    const { validating } = makeObservationPipeline();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-3")!;
    validating.record(subjectId, "publishing", 10);
    validating.record(subjectId, "accepted", 20);
    expect(validating.record(subjectId, "publishing", 30)).toBe("invalid-transition");

    const staleSubject = toFedosDeliveryObservationSubjectId("subject-3-stale")!;
    validating.record(staleSubject, "publishing", 10);
    expect(validating.record(staleSubject, "failed", 5)).toBe("stale");
  });

  it("4. Scheduler protocol neutrality: no Nostr/Relay reference in fedos_publish_scheduler.ts", () => {
    const codeOnly = schedulerSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/Nostr|Relay/i);
  });

  it("5. repeated attempt policy: single-attempt terminal model, and the retry table has no numeric/backoff field", () => {
    const { validating } = makeObservationPipeline();
    const subjectId = toFedosDeliveryObservationSubjectId("subject-5")!;
    validating.record(subjectId, "publishing", 1);
    validating.record(subjectId, "failed", 2);
    expect(validating.record(subjectId, "publishing", 3)).toBe("invalid-transition");
    for (const outcome of ["accepted", "rejected", "failed"] as const) {
      expect(typeof outboundPublishOutcomeToRetryPolicy(outcome)).toBe("string");
    }
  });

  it("6. independent instances never share state (Scheduler and Observation Repository alike)", async () => {
    const a = makeObservationPipeline();
    const b = makeObservationPipeline();
    const subjectId = toFedosDeliveryObservationSubjectId("shared-name-different-instance")!;
    a.validating.record(subjectId, "queued", 1);
    expect(b.query.currentStateFor(subjectId)).toBeNull();

    const outboxA = new InMemoryFedosBoardOutboxPersistence();
    const outboxB = new InMemoryFedosBoardOutboxPersistence();
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => sampleEvent);
    const postId = toFedosBoardPostId("post-independent")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxA.putIntent(serializeFedosBoardOutboxIntent(intent));
    const schedulerA = new FedosPublishScheduler({ outboxPersistence: outboxA, publisher: adapter, intervalMs: 1000 });
    const schedulerB = new FedosPublishScheduler({ outboxPersistence: outboxB, publisher: adapter, intervalMs: 1000 });
    await schedulerA.tick();
    expect((await schedulerB.tick())).toHaveLength(0);
  });

  it("7. no Host owner, no automatic scheduler start", () => {
    const schedulerImports = (schedulerSource as string).match(/^import .*$/gm) ?? [];
    expect(schedulerImports.join("\n")).not.toMatch(/FedosDesktopHost/);
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const relay = new NullRelay("wss://relay.example.test");
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => sampleEvent);
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher: adapter, intervalMs: 1000 });
    expect(scheduler.isRunning()).toBe(false);
  });

  it("8. durable Observation wiring is not implemented -- the bridge is a pure value mapping, no Persistence/Repository import", () => {
    const bridgeImports = (bridgeSource as string).match(/^import .*$/gm) ?? [];
    expect(bridgeImports.join("\n")).not.toMatch(/Persistence|Repository/);
  });
});

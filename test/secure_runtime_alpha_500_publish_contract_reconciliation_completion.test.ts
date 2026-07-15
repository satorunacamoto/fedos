import { describe, it, expect } from "vitest";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import { isFedosOutboundPublishResult } from "../src/board/publish/fedos_outbound_publish_result.js";
import { isAllowedFedosDeliveryObservationTransition } from "../src/board/observation/fedos_delivery_observation_transition_graph.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { fedosBoardOutboxObservationToDeliveryObservation } from "../src/board/outbox/fedos_board_outbox_observation_to_delivery_observation.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_500_publish_contract_reconciliation_completion.md?raw";

describe("Secure Runtime Alpha 500 -- Publish Contract Reconciliation Completion", () => {
  it("declares every Stage 491-499 complete", () => {
    for (let n = 491; n <= 499; n++) {
      expect(doc).toContain(`secure_runtime_alpha_${n}_`);
    }
  });

  it("every piece this Arc built is importable and usable together", async () => {
    expect(typeof FedosNostrBoardPublisherAdapter).toBe("function");
    expect(typeof FedosRelayNostrBoardPublisher).toBe("function");
    expect(typeof isFedosOutboundPublishResult).toBe("function");
    expect(typeof isAllowedFedosDeliveryObservationTransition).toBe("function");
    expect(typeof FedosValidatingDeliveryObservationRepository).toBe("function");
    expect(typeof fedosBoardOutboxObservationToDeliveryObservation).toBe("function");
    const relay = new NullRelay("wss://relay.example.test");
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => null);
    expect(typeof adapter.publish).toBe("function");
  });

  it("names the next Arc recommendation and every absolute prohibition honored", () => {
    expect(doc).toMatch(/Secure Runtime Alpha 501–510: Durable Delivery Observation Wiring\s+Arc/);
    for (const term of [
      "Host ownership",
      "durable Observation wiring",
      "retry/backoff redesign",
      "Relay connection Pool",
      "ActivityPub",
      "GUI",
      "p2p/",
      "Ontology",
    ]) {
      expect(doc).toContain(term);
    }
    expect(doc).toMatch(/automatic Scheduler\s+start/);
  });

  it("claims zero edits to any pre-existing production file, and names the dedicated worktree/branch", () => {
    expect(doc).toMatch(/Zero edits to any pre-existing production file/);
    expect(doc).toContain("worktree-alpha-491-500");
  });
});

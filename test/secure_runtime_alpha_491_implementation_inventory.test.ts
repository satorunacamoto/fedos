import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_491_implementation_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherSource from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxObservationSource from "../src/os/messenger/board/outbox/fedos_board_outbox_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deliveryObservationSource from "../src/os/messenger/board/observation/fedos_delivery_observation.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("Secure Runtime Alpha 491 -- Implementation Inventory", () => {
  it("no file under src/board/outbox references the Nostr Publisher thread", () => {
    expect(codeOnly(schedulerSource)).not.toMatch(/Nostr|Relay/i);
    expect(codeOnly(outboxPublisherSource)).not.toMatch(/Nostr|Relay/i);
  });

  it("no file under src/board/publish/nostr references FedosBoardOutboxPublisher", () => {
    expect(codeOnly(nostrPublisherSource)).not.toMatch(/FedosBoardOutboxPublisher/);
  });

  it("the Scheduler's publisher dependency is the generic FedosBoardOutboxPublisher, injected", () => {
    expect(schedulerSource).toContain("readonly publisher: FedosBoardOutboxPublisher;");
  });

  it("the retry-policy three-value union is defined exactly once in the repository", () => {
    expect(outboxPublisherSource).toMatch(
      /export type FedosBoardOutboxRetryPolicy = "immediate" \| "later" \| "never";/,
    );
    expect(codeOnly(nostrPublisherSource)).not.toMatch(/"immediate"\s*\|\s*"later"\s*\|\s*"never"/);
  });

  it("the two Observation vocabularies use different subject-field names and different state values", () => {
    expect(outboxObservationSource).toContain("readonly outboxId: FedosBoardOutboxId;");
    expect(outboxObservationSource).toContain(
      'export type FedosBoardOutboxObservationKind = "attempt-started" | "delivered" | "rejected" | "failed" | "abandoned";',
    );
    expect(deliveryObservationSource).toContain("readonly subjectId: FedosDeliveryObservationSubjectId;");
    expect(deliveryObservationSource).toContain(
      'export type FedosDeliveryObservationState = "queued" | "publishing" | "accepted" | "rejected" | "failed";',
    );
  });

  it("FedosDeliveryObservation's own five states already match this Arc's required canonical vocabulary verbatim", () => {
    for (const state of ["queued", "publishing", "accepted", "rejected", "failed"]) {
      expect(deliveryObservationSource).toContain(`"${state}"`);
    }
  });

  it("the doc records that zero production caller constructs the Scheduler or the Nostr Publisher", () => {
    expect(doc).toMatch(/zero matches/);
  });

  it("the doc cross-references the Alpha 481-490 review Arc", () => {
    for (const ref of [
      "secure_runtime_alpha_482_publish_pipeline_type_duplication_review",
      "secure_runtime_alpha_483_delivery_state_transition_closure_review",
      "secure_runtime_alpha_490_publish_pipeline_integration_review_completion",
    ]) {
      expect(doc).toContain(ref);
    }
  });
});

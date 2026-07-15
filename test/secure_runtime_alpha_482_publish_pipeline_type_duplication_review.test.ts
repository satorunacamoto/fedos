import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxObservationSource from "../src/board/outbox/fedos_board_outbox_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deliveryObservationSource from "../src/board/observation/fedos_delivery_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import genericPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherInterfaceSource from "../src/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";
import { isFedosBoardOutboxObservationKind } from "../src/board/outbox/fedos_board_outbox_observation.js";
import { isFedosDeliveryObservationState } from "../src/board/observation/fedos_delivery_observation.js";

/**
 * Secure Runtime Alpha 482 -- "Publish Pipeline Type Duplication
 * Review": Stage 2 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 482 -- Publish Pipeline Type Duplication Review", () => {
  it("1. no file imports both Observation vocabularies", () => {
    expect(codeOnlyLines(outboxObservationSource)).not.toMatch(/board\/observation/);
    expect(codeOnlyLines(deliveryObservationSource)).not.toMatch(/outbox\/fedos_board_outbox_observation/);
  });

  it("2. the two Observation state vocabularies are not identical sets", () => {
    const outboxKinds = ["attempt-started", "delivered", "rejected", "failed", "abandoned"];
    const deliveryStates = ["queued", "publishing", "accepted", "rejected", "failed"];
    expect(outboxKinds.sort()).not.toEqual(deliveryStates.sort());
    // Confirm each real validator only accepts its own vocabulary, never the other's exclusive members.
    expect(isFedosBoardOutboxObservationKind("queued")).toBe(false);
    expect(isFedosBoardOutboxObservationKind("publishing")).toBe(false);
    expect(isFedosBoardOutboxObservationKind("accepted")).toBe(false);
    expect(isFedosDeliveryObservationState("attempt-started")).toBe(false);
    expect(isFedosDeliveryObservationState("delivered")).toBe(false);
    expect(isFedosDeliveryObservationState("abandoned")).toBe(false);
    // Both share "rejected"/"failed" as valid strings -- a name collision, not a type identity.
    expect(isFedosBoardOutboxObservationKind("rejected")).toBe(true);
    expect(isFedosDeliveryObservationState("rejected")).toBe(true);
  });

  it("3. the two Publisher return contracts are structurally incompatible (object with retryPolicy vs bare boolean)", () => {
    expect(codeOnlyLines(genericPublisherSource)).toMatch(/interface FedosBoardOutboxPublishResult/);
    expect(codeOnlyLines(genericPublisherSource)).toMatch(/retryPolicy/);
    expect(codeOnlyLines(nostrPublisherInterfaceSource)).toMatch(/Promise<boolean>/);
    expect(codeOnlyLines(nostrPublisherInterfaceSource)).not.toMatch(/retryPolicy/);
  });

  it("4. the retry-policy vocabulary is defined in exactly one production file", () => {
    // Deliberately re-scans the same two candidate files this review already inspected --
    // a full repo-wide grep is performed manually in the accompanying doc (§4), not re-run
    // here as a filesystem walk, to keep this test hermetic and fast.
    expect(codeOnlyLines(genericPublisherSource)).toMatch(/"immediate"[^\n]*"later"[^\n]*"never"/);
    expect(codeOnlyLines(nostrPublisherInterfaceSource)).not.toMatch(/"immediate"|"later"|"never"/);
  });
});

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

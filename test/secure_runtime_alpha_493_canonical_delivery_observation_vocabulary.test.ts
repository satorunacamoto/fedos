import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_493_canonical_delivery_observation_vocabulary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deliveryObservationSource from "../src/os/messenger/board/observation/fedos_delivery_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxObservationSource from "../src/os/messenger/board/outbox/fedos_board_outbox_observation.ts?raw";

describe("Secure Runtime Alpha 493 -- Canonical Delivery Observation Vocabulary", () => {
  it("FedosDeliveryObservation remains byte-for-byte the Alpha 462 shape (adopted, not edited)", () => {
    expect(deliveryObservationSource).toContain(
      'export type FedosDeliveryObservationState = "queued" | "publishing" | "accepted" | "rejected" | "failed";',
    );
    expect(deliveryObservationSource).toContain("export function createFedosDeliveryObservation(");
  });

  it("FedosBoardOutboxObservation remains byte-for-byte the Alpha 475 shape (deprecated, not edited)", () => {
    expect(outboxObservationSource).toContain(
      'export type FedosBoardOutboxObservationKind = "attempt-started" | "delivered" | "rejected" | "failed" | "abandoned";',
    );
  });

  it("the mapping table names all five old kinds and their target state", () => {
    for (const pair of [
      ["attempt-started", "publishing"],
      ["delivered", "accepted"],
      ["rejected", "rejected"],
      ["failed", "failed"],
      ["abandoned", "failed"],
    ]) {
      expect(doc).toMatch(new RegExp(`\`${pair[0]}\`[\\s\\S]{0,20}\`${pair[1]}\``));
    }
  });

  it("the doc names the deprecated-adapter boundary requirement and its own future filename", () => {
    expect(doc).toContain("fedosBoardOutboxObservationToDeliveryObservation");
    expect(doc).toMatch(/deprecated adapter boundary/);
  });

  it("the adapter function this Stage names is built later, by Alpha 497, at exactly this path", () => {
    expect(existsSync("src/board/outbox/fedos_board_outbox_observation_to_delivery_observation.ts")).toBe(true);
  });

  it("explains why abandoned maps to failed rather than becoming a sixth canonical state", () => {
    expect(doc).toMatch(/out of scope this Arc reconciles existing|out of scope \(this Arc reconciles existing/);
  });
});

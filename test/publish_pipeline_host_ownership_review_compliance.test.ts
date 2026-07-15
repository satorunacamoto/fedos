import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc01 from "../docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc02 from "../docs/publish_pipeline_host_ownership_review_02_startup_ordering.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc03 from "../docs/publish_pipeline_host_ownership_review_03_shutdown_ordering.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc04 from "../docs/publish_pipeline_host_ownership_review_04_failure_isolation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc05 from "../docs/publish_pipeline_host_ownership_review_05_ownership_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc06 from "../docs/publish_pipeline_host_ownership_review_06_durable_observation_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc07 from "../docs/publish_pipeline_host_ownership_review_07_outbox_processing.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc08 from "../docs/publish_pipeline_host_ownership_review_08_protocol_extensibility.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc09 from "../docs/publish_pipeline_host_ownership_review_09_private_board_dm_eligibility.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc10 from "../docs/publish_pipeline_host_ownership_review_10_abuse_defense_separation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc11 from "../docs/publish_pipeline_host_ownership_review_11_deliverables_and_dependency_order.md?raw";

/**
 * Publish Pipeline Host Ownership Review -- prohibition compliance.
 * Verifies this review's OWN recommended design (its docs) never
 * mixes in the six named abuse-defense concerns, GUI, Relay Pool, or
 * p2p/, and that the package manifest carries no new dependency this
 * review might have introduced. This review adds no src/ file at all,
 * so there is no production source for this test to inspect for
 * prohibition compliance beyond the manifest itself.
 */
describe("Publish Pipeline Host Ownership Review -- prohibition compliance", () => {
  const allDocs: Record<string, string> = {
    "01_ownership_matrix": doc01,
    "02_startup_ordering": doc02,
    "03_shutdown_ordering": doc03,
    "04_failure_isolation": doc04,
    "05_ownership_api": doc05,
    "06_durable_observation_wiring": doc06,
    "07_outbox_processing": doc07,
    "08_protocol_extensibility": doc08,
    "09_private_board_dm_eligibility": doc09,
    "10_abuse_defense_separation": doc10,
    "11_deliverables_and_dependency_order": doc11,
  };

  it("1. package.json still carries exactly two production dependencies -- no new dependency introduced", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("2. no review doc recommends Lightning stake, NIP-13 PoW, Capability invite, JA4, or CrowdSec as part of the delivery Host design itself", () => {
    // Docs 09/10 discuss these terms explicitly, but only to say where they DO NOT belong --
    // this check instead confirms no OTHER doc (01-08, 11, i.e. the actual design docs)
    // references them at all, which is the stronger, more direct guarantee.
    const designDocs = ["01_ownership_matrix", "02_startup_ordering", "03_shutdown_ordering", "04_failure_isolation", "05_ownership_api", "06_durable_observation_wiring", "07_outbox_processing", "08_protocol_extensibility", "11_deliverables_and_dependency_order"];
    for (const key of designDocs) {
      const text = allDocs[key]!;
      expect(text, key).not.toMatch(/lightning|nip-13|proof.of.work|\bpow\b/i);
      expect(text, key).not.toMatch(/capability invite/i);
      expect(text, key).not.toMatch(/\bja4\b/i);
      expect(text, key).not.toMatch(/crowdsec/i);
      expect(text, key).not.toMatch(/ontology/i);
    }
  });

  it("3. no review doc recommends a GUI, a Relay connection Pool, or a p2p/ dependency as part of the design", () => {
    for (const [key, text] of Object.entries(allDocs)) {
      expect(text, key).not.toMatch(/\bGUI\b/);
      expect(text, key).not.toMatch(/relay pool|connection pool/i);
      expect(text, key).not.toMatch(/p2p\//);
    }
  });

  it("4. no review doc proposes changing the FedosBoardOutboxPublisher, FedosDeliveryObservation, or FedosPublishScheduler TYPE shape", () => {
    for (const [key, text] of Object.entries(allDocs)) {
      expect(text, key).not.toMatch(/rename FedosBoardOutboxPublisher|redefine FedosBoardOutboxPublisher/i);
      expect(text, key).not.toMatch(/rename FedosDeliveryObservation|redefine FedosDeliveryObservation/i);
      expect(text, key).not.toMatch(/rename FedosPublishScheduler|redefine FedosPublishScheduler/i);
    }
  });
});

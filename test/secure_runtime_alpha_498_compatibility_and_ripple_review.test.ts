import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_498_compatibility_and_ripple_review.md?raw";

const NEW_SYMBOLS = [
  "FedosNostrBoardPublisherAdapter",
  "FedosOutboundPublishResult",
  "fedos_delivery_observation_transition_graph",
  "fedos_delivery_observation_write_validator",
  "fedos_board_outbox_observation_to_delivery_observation",
  "FedosValidatingDeliveryObservationRepository",
];

function preExisting451To490DocsAndTests(): string[] {
  const files: string[] = [];
  for (const dir of ["docs", "test"]) {
    for (const name of readdirSync(dir)) {
      const match = name.match(/^secure_runtime_alpha_(\d+)_/);
      if (match === null) continue;
      const n = Number(match[1]);
      if (n >= 451 && n <= 490) files.push(`${dir}/${name}`);
    }
  }
  return files;
}

describe("Secure Runtime Alpha 498 -- Compatibility and Ripple Review", () => {
  it("no pre-existing Alpha 451-490 doc or test references any new symbol/path this Arc adds", () => {
    for (const file of preExisting451To490DocsAndTests()) {
      const content = readFileSync(file, "utf8");
      for (const symbol of NEW_SYMBOLS) {
        expect(content, `${file} should not mention ${symbol}`).not.toContain(symbol);
      }
    }
  });

  it("the doc records zero ripple required", () => {
    expect(doc).toMatch(/No match anywhere\./);
  });

  it("the doc explains why regex strength was never weakened", () => {
    expect(doc).toMatch(/no `\.toBe\(false\)`\s+was changed to a looser wildcard/);
  });

  it("Alpha 489's own boundary-audit test imports its six observation sources by explicit path, not a directory scan", () => {
    const content = readFileSync(
      "test/secure_runtime_alpha_489_publish_pipeline_boundary_dependency_audit.test.ts",
      "utf8",
    );
    expect(content).not.toMatch(/readdirSync/);
    expect(content).toMatch(/observationTypeSource/);
  });
});

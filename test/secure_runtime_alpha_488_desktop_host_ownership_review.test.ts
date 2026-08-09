import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 488 -- "Desktop Host Ownership Review": Stage 8
 * of the Alpha 481-490 Publish Pipeline Integration Review Arc. Review
 * test only.
 */
describe("Secure Runtime Alpha 488 -- Desktop Host Ownership Review", () => {
  const code = codeOnlyLines(hostSource);

  it("1. Host's Outbox-adjacent surface is exactly persistence + intent construction + codec serialize", () => {
    expect(code).toMatch(/FedosBoardOutboxPersistence/);
    expect(code).toMatch(/createFedosBoardOutboxIntent/);
    expect(code).toMatch(/serializeFedosBoardOutboxIntent/);
  });

  it("2. Host source referenced no Publisher, Scheduler, or Observation type as of THIS Stage -- fulfilled later, by Alpha 501-520", () => {
    // This Stage (Alpha 488) itself found zero production caller and zero
    // ownership of any of the three. Alpha 501-520 (Canonical Publisher &
    // Delivery Observation Contract Reconciliation's own recommended next
    // Arc) later gives Host real, additive ownership of all three -- see
    // docs/secure_runtime_alpha_507_host_constructor_and_factory_wiring.md.
    // This check now confirms fulfillment, not continued absence.
    expect(code).toMatch(/Publisher/);
    expect(code).toMatch(/Scheduler/);
    expect(code).toMatch(/Observation/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

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

  it("2. Host source references no Publisher, Scheduler, or Observation type", () => {
    expect(code).not.toMatch(/Publisher/);
    expect(code).not.toMatch(/Scheduler/);
    expect(code).not.toMatch(/Observation/);
  });
});

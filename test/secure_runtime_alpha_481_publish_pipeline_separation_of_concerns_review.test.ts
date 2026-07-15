import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import genericPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherInterfaceSource from "../src/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherImplSource from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

/**
 * Secure Runtime Alpha 481 -- "Publish Pipeline Separation of Concerns
 * Review": Stage 1 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. A REVIEW test only -- imports existing, unmodified
 * production source as text (`?raw`) and asserts facts about it. Writes
 * nothing, calls no production mutation path.
 */

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

describe("Secure Runtime Alpha 481 -- Publish Pipeline Separation of Concerns Review", () => {
  it("1. neither Publisher implementation constructs an Observation itself", () => {
    for (const source of [genericPublisherSource, nostrPublisherInterfaceSource, nostrPublisherImplSource]) {
      const code = codeOnlyLines(source);
      expect(code).not.toMatch(/createFedosBoardOutboxObservation|createFedosDeliveryObservation/);
      expect(code).not.toMatch(/from\s+["'].*observation/);
    }
  });

  it("2. the generic Publisher's own return contract carries a retry-policy field (a scheduling-adjacent concern)", () => {
    expect(codeOnlyLines(genericPublisherSource)).toMatch(/retryPolicy/);
  });

  it("3. the Nostr-specific Publisher's own return contract carries no retry-policy field of any kind", () => {
    expect(codeOnlyLines(nostrPublisherInterfaceSource) + codeOnlyLines(nostrPublisherImplSource)).not.toMatch(
      /retryPolicy|retry_policy/i,
    );
  });

  it("4. the Scheduler both authors Observations (#observe) and owns their in-memory storage/retrieval (#observationLog / observationLog())", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).toMatch(/#observe\s*\(/);
    expect(code).toMatch(/#observationLog/);
    expect(code).toMatch(/observationLog\s*\(\s*\)\s*:/);
  });

  it("5. the Scheduler never delegates Observation storage to any Observation Repository/Persistence type", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).not.toMatch(/ObservationRepository|ObservationPersistence|ObservationQuery/);
  });
});

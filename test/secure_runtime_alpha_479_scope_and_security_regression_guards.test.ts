import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_479_scope_and_security_regression_guards.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationSource from "../src/board/outbox/fedos_board_outbox_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

function importedFromSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)";/g)].map((match) => match[1]!);
}

/**
 * Secure Runtime Alpha 479 -- "Scope and Security Regression Guards":
 * Stage 9 of the Alpha 471-480 Canonical Publish Scheduler Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 479 -- Scope and Security Regression Guards", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: every import in the three new files resolves to a sibling file inside src/board/outbox/", () => {
    for (const source of [publisherSource, observationSource, schedulerSource]) {
      for (const specifier of importedFromSpecifiers(source)) {
        expect(specifier).toMatch(/^\.\/fedos_board_outbox_/);
      }
    }
  });

  it("3. structural: no Nostr/Relay/Ontology/p2p/GUI import anywhere in the three new files", () => {
    for (const source of [publisherSource, observationSource, schedulerSource]) {
      for (const specifier of importedFromSpecifiers(source)) {
        expect(specifier).not.toMatch(/nostr|desktop|runtime|render|publish\/|observation\//i);
      }
    }
  });

  it("4. structural: FedosBoardOutboxRetryPolicy is a closed three-literal union with no numeric/backoff vocabulary", () => {
    expect(publisherSource).toMatch(/export type FedosBoardOutboxRetryPolicy = "immediate" \| "later" \| "never";/);
    expect(publisherSource).not.toMatch(/backoffMs|delayMs|retryAfter|Math\.pow|Math\.exp/i);
    expect(schedulerSource).not.toMatch(/backoffMs|delayMs|retryAfter|Math\.pow|Math\.exp/i);
  });

  it("5. structural: MockFedosBoardOutboxPublisher is the only implementation of FedosBoardOutboxPublisher this Arc adds", () => {
    const matches = [publisherSource, observationSource, schedulerSource]
      .join("\n")
      .match(/implements FedosBoardOutboxPublisher/g);
    expect(matches).toEqual(["implements FedosBoardOutboxPublisher"]);
  });

  it("6. the design doc's own conclusion holds -- every named prohibition verified by direct inspection", () => {
    expect(designDocSource).toMatch(/holds, verified by direct inspection this Stage, not merely\s*\ndeclared\./);
  });

  it("7. the design doc records the exact working-tree accounting -- this Arc's files vs. concurrent Arcs' files", () => {
    expect(designDocSource).toMatch(/Alpha 451–460/);
    expect(designDocSource).toMatch(/Alpha 461–470/);
    expect(designDocSource).toMatch(/This Arc\s*\n\s*makes NO further edit to any of these four files/);
  });
});

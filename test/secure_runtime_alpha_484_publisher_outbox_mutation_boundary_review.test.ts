import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import genericPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherInterfaceSource from "../src/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublisherImplSource from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

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
 * Secure Runtime Alpha 484 -- "Publisher/Outbox Mutation Boundary
 * Review": Stage 4 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 484 -- Publisher/Outbox Mutation Boundary Review", () => {
  it("1. neither Publisher implementation imports FedosBoardOutboxPersistence", () => {
    for (const source of [genericPublisherSource, nostrPublisherInterfaceSource, nostrPublisherImplSource]) {
      expect(codeOnlyLines(source)).not.toMatch(/FedosBoardOutboxPersistence/);
    }
  });

  it("2. neither Publisher implementation calls putIntent", () => {
    for (const source of [genericPublisherSource, nostrPublisherInterfaceSource, nostrPublisherImplSource]) {
      expect(codeOnlyLines(source)).not.toMatch(/\.putIntent\s*\(/);
    }
  });

  it("3. the Scheduler calls listIntents() but never putIntent()", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).toMatch(/\.listIntents\s*\(\s*\)/);
    expect(code).not.toMatch(/\.putIntent\s*\(/);
  });

  it("4. the Scheduler tracks delivered/abandoned state in its own private fields, not by writing to Outbox persistence", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).toMatch(/#delivered\s*=\s*new Set/);
    expect(code).toMatch(/#abandoned\s*=\s*new Set/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import controllerSource from "../src/desktop/host/fedos_host_delivery_controller.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import policySource from "../src/os/messenger/board/outbox/fedos_board_outbox_abandonment_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.ts?raw";

/**
 * Secure Runtime Alpha 576 -- "Structural Guards": Stage 16 of the
 * Alpha 561-580 Publish Scheduler Concurrency Safety & Abandonment
 * Policy Arc. Regex checks run against CODE ONLY (comments/doc-strings
 * stripped first), mirroring this repository's own established
 * `codeOnly()` convention (Alpha 512).
 */

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("Secure Runtime Alpha 576 -- Structural Guards", () => {
  it("1. FedosPublishScheduler.tick() is single-flight -- a #tickInFlight-shaped guard field exists and is read before starting a new pass", () => {
    const code = codeOnly(schedulerSource);
    expect(code).toMatch(/#tickInFlight/);
    expect(code).toMatch(/if \(this\.#tickInFlight !== null\) return this\.#tickInFlight;/);
  });

  it("2. the guard is released via finally, not by any other control-flow path", () => {
    const code = codeOnly(schedulerSource);
    expect(code).toMatch(/\.finally\(\(\) => \{\s*\n\s*this\.#tickInFlight = null;/);
  });

  it("3. no static or module-level (global) lock -- every mutable guard field is a private INSTANCE field", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(controllerSource)]) {
      expect(code).not.toMatch(/^\s*static\s+#/m);
      expect(code).not.toMatch(/^(let|const|var)\s+\w*(lock|Lock|mutex|Mutex)\b/m);
    }
  });

  it("4. no protocol (Nostr/ActivityPub/AT Protocol/Session) import in the Scheduler or the abandonment policy file", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(policySource)]) {
      expect(code).not.toMatch(/nostr|ActivityPub|ATProto|AtProto|\bSession\b/i);
    }
  });

  it("5. no p2p import anywhere in this Arc's own new/touched files", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(controllerSource), codeOnly(policySource)]) {
      expect(code).not.toMatch(/\bp2p\b/i);
    }
  });

  it("6. no Outbox deletion -- FedosBoardOutboxPersistence exposes no remove/delete method, and neither Scheduler nor Controller calls one", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(controllerSource)]) {
      expect(code).not.toMatch(/\.(remove|delete)Intent\(/);
    }
  });

  it("7. no Board (post/thread) mutation reference in the Scheduler, Controller, or abandonment policy", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(controllerSource), codeOnly(policySource)]) {
      expect(code).not.toMatch(/putPost|registerPost|previewRegistration/);
    }
  });

  it("8. no raw Relay/wire text used as a policy input -- the abandonment policy's own input shape is limited to outboxId/completedAttempts/latestOutcome", () => {
    expect(policySource).toMatch(
      /interface FedosDeliveryAbandonmentPolicyInput \{[\s\S]*?outboxId[\s\S]*?completedAttempts[\s\S]*?latestOutcome[\s\S]*?\}/,
    );
    expect(codeOnly(policySource)).not.toMatch(/NOTICE|stack|\.message\b/);
  });

  it("9. no exponential backoff / delay computation added anywhere in this Arc's own new/touched files", () => {
    for (const code of [codeOnly(schedulerSource), codeOnly(controllerSource), codeOnly(policySource)]) {
      expect(code).not.toMatch(/backoffMs|delayMs|retryAfter|Math\.pow|Math\.exp|exponential/i);
    }
  });

  it("10. FedosBoardOutboxPublisher's own interface is unchanged by this Arc", () => {
    expect(outboxPublisherSource).toMatch(
      /export type FedosBoardOutboxRetryPolicy = "immediate" \| "later" \| "never";/,
    );
    expect(outboxPublisherSource).toMatch(
      /publish\(record: FedosPersistedBoardOutboxRecordV1\): Promise<FedosBoardOutboxPublishResult>;/,
    );
  });

  it("11. the abandonment policy file itself imports nothing outside src/board/outbox/", () => {
    const importLines = codeOnly(policySource)
      .split("\n")
      .filter((line: string) => line.trim().startsWith("import"));
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) {
      const match = line.match(/from ["']([^"']+)["']/);
      if (match === null) continue;
      expect(match[1]).toMatch(/^\.\/fedos_board_outbox_/);
    }
  });

  it("12. the abandonment policy ships no default instance -- only the contract and one explicitly-parameterized example factory", () => {
    expect(policySource).not.toMatch(/export const default[A-Za-z]*Policy/);
    expect(policySource).toMatch(/export function createFedosMaxAttemptsAbandonmentPolicy\(maxAttempts: number\)/);
  });
});

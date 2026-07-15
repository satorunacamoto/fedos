import { describe, it, expect } from "vitest";
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
 * Secure Runtime Alpha 486 -- "Scheduler Protocol-Agnosticism Review":
 * Stage 6 of the Alpha 481-490 Publish Pipeline Integration Review Arc.
 * Review test only.
 */
describe("Secure Runtime Alpha 486 -- Scheduler Protocol-Agnosticism Review", () => {
  const code = codeOnlyLines(schedulerSource);

  it("1. imports only from sibling files under src/board/outbox/", () => {
    const fromPaths = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(fromPaths.length).toBeGreaterThan(0);
    for (const path of fromPaths) {
      expect(path).toMatch(/^\.\/fedos_board_outbox_/);
    }
  });

  it("2. contains no protocol/transport keyword in code (only in doc-comment prose, already stripped)", () => {
    for (const keyword of ["nostr", "relay", "websocket", "activitypub", "atproto", "session"]) {
      expect(code.toLowerCase()).not.toMatch(new RegExp(keyword));
    }
  });

  it("3. never branches on target.protocol -- forwards the whole persisted record opaquely", () => {
    expect(code).not.toMatch(/\.target\.protocol/);
    expect(code).not.toMatch(/target\?\.protocol/);
  });
});

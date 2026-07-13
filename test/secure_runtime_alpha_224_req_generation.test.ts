import { describe, it, expect } from "vitest";
import { buildReqMessage } from "../src/desktop/subscription_messages.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_224_req_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagesSource from "../src/desktop/subscription_messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyMessagesSource from "../src/nostr/messages.ts?raw";

/**
 * Secure Runtime Alpha 224 -- "REQ Generation": Stage 4 of the Nostr
 * Subscription Foundation Arc. Adds src/desktop/subscription_messages.ts,
 * exporting buildReqMessage -- a pure function producing NIP-01's own
 * ["REQ", id, ...filters] wire string. Transport only, no event
 * processing, no socket I/O, no id generation.
 */
describe("Secure Runtime Alpha 224 -- REQ Generation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/subscription_messages\.ts`, exporting `buildReqMessage`\./,
    );
  });

  it("3. structural: buildReqMessage is exported and imports FedosSubscriptionFilter as a type-only import", () => {
    expect(messagesSource).toMatch(/export function buildReqMessage\(/);
    expect(messagesSource).toMatch(
      /import type \{ FedosSubscriptionFilter \} from "\.\/fedos_subscription_filter\.js";/,
    );
  });

  it("4. structural: no socket/WebSocket/fetch reference, and no EVENT/EOSE/NOTICE reference, exists in this file's own CODE", () => {
    const codeOnly = messagesSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/WebSocket|fetch|socket|EVENT|EOSE|NOTICE/);
  });

  it("5. the design doc cross-references Alpha 223, Alpha 216, and Alpha 221", () => {
    for (const ref of [
      "secure_runtime_alpha_223_filter_representation",
      "secure_runtime_alpha_216_publish_api",
      "secure_runtime_alpha_221_subscription_code_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("6. Regression: src/nostr/messages.ts carries no reference to this Stage's own doc or buildReqMessage", () => {
    expect(legacyMessagesSource).not.toMatch(/secure_runtime_alpha_224/);
    expect(legacyMessagesSource).not.toMatch(/buildReqMessage/);
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("7. behavioral: buildReqMessage produces exactly ['REQ', id, ...filters], with no filters given", () => {
    const raw = buildReqMessage("fedos-sub-1", []);
    expect(JSON.parse(raw)).toEqual(["REQ", "fedos-sub-1"]);
  });

  it("8. behavioral: buildReqMessage passes filters through verbatim, in order", () => {
    const filters: FedosSubscriptionFilter[] = [
      { kinds: [1], limit: 10 },
      { authors: ["a".repeat(64)] },
    ];
    const raw = buildReqMessage("fedos-sub-2", filters);
    expect(JSON.parse(raw)).toEqual(["REQ", "fedos-sub-2", { kinds: [1], limit: 10 }, { authors: ["a".repeat(64)] }]);
  });

  it("9. behavioral: buildReqMessage is pure -- calling it twice with the same arguments produces identical output", () => {
    const filters: FedosSubscriptionFilter[] = [{ ids: ["b".repeat(64)] }];
    expect(buildReqMessage("fedos-sub-3", filters)).toBe(buildReqMessage("fedos-sub-3", filters));
  });
});

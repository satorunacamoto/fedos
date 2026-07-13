import { describe, it, expect } from "vitest";
import { buildCloseMessage, buildReqMessage } from "../src/desktop/subscription_messages.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_225_close_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagesSource from "../src/desktop/subscription_messages.ts?raw";

/**
 * Secure Runtime Alpha 225 -- "CLOSE Generation": Stage 5 of the Nostr
 * Subscription Foundation Arc. Adds buildCloseMessage to
 * subscription_messages.ts -- a pure function producing NIP-01's own
 * ["CLOSE", id] wire string. This is the FINAL, complete shape of this
 * file for this Arc.
 */
describe("Secure Runtime Alpha 225 -- CLOSE Generation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one existing file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/subscription_messages\.ts`, adding one new function,\s*\n`buildCloseMessage`\./,
    );
  });

  it("3. structural: subscription_messages.ts's final shape exports exactly buildReqMessage and buildCloseMessage, in that order", () => {
    const exportNames = [...messagesSource.matchAll(/^export function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["buildReqMessage", "buildCloseMessage"]);
    expect(messagesSource).toMatch(
      /export function buildCloseMessage\(subscriptionId: string\): string \{\s*\n\s*return JSON\.stringify\(\["CLOSE", subscriptionId\]\);\s*\n\}/,
    );
  });

  it("4. structural: no socket/WebSocket/fetch reference exists in this file's own CODE", () => {
    const codeOnly = messagesSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/WebSocket|fetch|socket/);
  });

  it("5. the design doc cross-references Alpha 224, Alpha 223, and Alpha 215", () => {
    for (const ref of [
      "secure_runtime_alpha_224_req_generation",
      "secure_runtime_alpha_223_filter_representation",
      "secure_runtime_alpha_215_connection_lifecycle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("6. behavioral: buildCloseMessage produces exactly ['CLOSE', id]", () => {
    const raw = buildCloseMessage("fedos-sub-1");
    expect(JSON.parse(raw)).toEqual(["CLOSE", "fedos-sub-1"]);
  });

  it("7. behavioral: buildCloseMessage closes the SAME id buildReqMessage opened, when both are called with the same id", () => {
    const id = "fedos-sub-42";
    const req = JSON.parse(buildReqMessage(id, [{ kinds: [1] }]));
    const close = JSON.parse(buildCloseMessage(id));
    expect(req[1]).toBe(id);
    expect(close[1]).toBe(id);
  });

  it("8. behavioral: buildCloseMessage is pure -- calling it twice with the same id produces identical output", () => {
    expect(buildCloseMessage("fedos-sub-7")).toBe(buildCloseMessage("fedos-sub-7"));
  });
});

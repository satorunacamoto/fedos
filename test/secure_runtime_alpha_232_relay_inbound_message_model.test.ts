import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_232_relay_inbound_message_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageModelSource from "../src/desktop/fedos_relay_inbound_message.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyMessagesSource from "../src/os/messenger/adapters/nostr/protocol/messages.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 232 -- "Relay Inbound Message Model": Stage 2 of
 * the Nostr Relay Message Reception Arc. Adds
 * src/desktop/fedos_relay_inbound_message.ts -- a closed, four-member,
 * fully-readonly discriminated union (EVENT/EOSE/OK/NOTICE), no
 * free-form metadata bag, no fifth "unsupported" variant.
 */
describe("Secure Runtime Alpha 232 -- Relay Inbound Message Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_relay_inbound_message\.ts`\./,
    );
  });

  it("3. structural: exactly five exports, matching the four message interfaces plus the union", () => {
    const exportNames = [...messageModelSource.matchAll(/^export (?:interface|type) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportNames)).toEqual(
      new Set([
        "FedosRelayEventMessage",
        "FedosRelayEoseMessage",
        "FedosRelayOkMessage",
        "FedosRelayNoticeMessage",
        "FedosRelayInboundMessage",
      ]),
    );
  });

  it("4. structural: every field on every message interface is readonly", () => {
    const interfaceBodies = [...messageModelSource.matchAll(/export interface \w+ \{([\s\S]*?)\n\}/g)].map(
      (m) => m[1] ?? "",
    );
    expect(interfaceBodies.length).toBe(4);
    for (const body of interfaceBodies) {
      const fieldLines = body.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      for (const line of fieldLines) {
        expect(line.startsWith("readonly ")).toBe(true);
      }
    }
  });

  it("5. structural: no free-form metadata bag (index signature / Record<string, unknown>) exists", () => {
    expect(codeOnly(messageModelSource)).not.toMatch(/\[key: string\]|Record<string, unknown>/);
  });

  it("6. structural: the union has exactly four members, matching the four kind discriminants", () => {
    expect(messageModelSource).toMatch(
      /export type FedosRelayInboundMessage =\s*\n\s*\| FedosRelayEventMessage\s*\n\s*\| FedosRelayEoseMessage\s*\n\s*\| FedosRelayOkMessage\s*\n\s*\| FedosRelayNoticeMessage;/,
    );
    expect(messageModelSource).toMatch(/readonly kind: "event";/);
    expect(messageModelSource).toMatch(/readonly kind: "eose";/);
    expect(messageModelSource).toMatch(/readonly kind: "ok";/);
    expect(messageModelSource).toMatch(/readonly kind: "notice";/);
  });

  it("7. structural: FedosNostrWireEvent is imported as a type-only import", () => {
    expect(messageModelSource).toMatch(
      /import type \{ FedosNostrWireEvent \} from "\.\/fedos_nostr_wire_event\.js";/,
    );
  });

  it("8. structural: no unsupported/unknown fifth variant exists IN CODE", () => {
    expect(codeOnly(messageModelSource)).not.toMatch(/"unsupported"|"unknown"/);
  });

  it("9. the design doc cross-references Alpha 231, Alpha 234, and Alpha 222", () => {
    for (const ref of [
      "secure_runtime_alpha_231_existing_relay_inbound_inventory",
      "secure_runtime_alpha_234_inbound_event_representation",
      "secure_runtime_alpha_222_subscription_interface",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("10. Regression: src/nostr/messages.ts carries no reference to this Stage's own doc or its new symbols", () => {
    expect(legacyMessagesSource).not.toMatch(/secure_runtime_alpha_232/);
    expect(legacyMessagesSource).not.toMatch(/FedosRelayInboundMessage/);
  });
});

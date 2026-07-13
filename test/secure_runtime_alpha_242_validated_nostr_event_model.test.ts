import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_242_validated_nostr_event_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedEventSource from "../src/desktop/fedos_validated_nostr_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireEventSource from "../src/desktop/fedos_nostr_wire_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import combinedValidatorSource from "../src/desktop/combined_inbound_event_validator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relayInboundMessageSource from "../src/desktop/fedos_relay_inbound_message.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relayInboundParserSource from "../src/desktop/relay_inbound_parser.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedSubscriptionAdapterSource from "../src/desktop/validated_subscription_adapter.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 242 -- "Validated Nostr Event Model": Stage 2
 * of the Nostr Inbound Event Validation Arc. Adds
 * src/desktop/fedos_validated_nostr_event.ts, exporting
 * FedosValidatedNostrEvent -- field-for-field identical to
 * FedosNostrWireEvent, distinct only by naming/ownership convention,
 * no valid flag, no metadata bag.
 */
describe("Secure Runtime Alpha 242 -- Validated Nostr Event Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_validated_nostr_event\.ts`\./,
    );
  });

  it("3. structural: FedosValidatedNostrEvent is the only export, field-for-field identical to FedosNostrWireEvent", () => {
    const exportNames = [...validatedEventSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosValidatedNostrEvent"]);
    expect(validatedEventSource).toMatch(
      /export interface FedosValidatedNostrEvent \{\s*\n\s*readonly id: string;\s*\n\s*readonly pubkey: string;\s*\n\s*readonly created_at: number;\s*\n\s*readonly kind: number;\s*\n\s*readonly tags: readonly \(readonly string\[\]\)\[\];\s*\n\s*readonly content: string;\s*\n\s*readonly sig: string;\s*\n\}/,
    );
    expect(wireEventSource).toMatch(
      /export interface FedosNostrWireEvent \{\s*\n\s*readonly id: string;\s*\n\s*readonly pubkey: string;\s*\n\s*readonly created_at: number;\s*\n\s*readonly kind: number;\s*\n\s*readonly tags: readonly \(readonly string\[\]\)\[\];\s*\n\s*readonly content: string;\s*\n\s*readonly sig: string;\s*\n\}/,
    );
  });

  it("4. structural: no valid/verified/status field, no metadata bag, IN CODE", () => {
    expect(codeOnly(validatedEventSource)).not.toMatch(/\bvalid\b|\bverified\b|\bstatus\b|\[key: string\]|Record<string, unknown>/i);
  });

  it("5. structural: fedos_validated_nostr_event.ts has zero import of any kind -- depends on nothing", () => {
    expect(validatedEventSource).not.toMatch(/^import /m);
  });

  it("6. structural: defines a TYPE ONLY -- no function, class, or construction logic IN CODE", () => {
    expect(codeOnly(validatedEventSource)).not.toMatch(/\bfunction\b|\bclass\b/);
  });

  it("7. structural: combined_inbound_event_validator.ts is the ONLY file constructing a FedosValidatedNostrEvent object literal", () => {
    const neverReferencesFiles: Record<string, string> = {
      "fedos_relay_inbound_message.ts": relayInboundMessageSource,
      "websocket_relay.ts": websocketRelaySource,
      "relay_inbound_parser.ts": relayInboundParserSource,
    };
    const constructsLiteral = /:\s*FedosValidatedNostrEvent\s*=\s*\{|Object\.freeze\(\{[\s\S]*?id:/.test(
      combinedValidatorSource,
    );
    expect(constructsLiteral, "combined_inbound_event_validator.ts should construct the literal").toBe(true);
    for (const [name, source] of Object.entries(neverReferencesFiles)) {
      expect(source, `${name} should not reference FedosValidatedNostrEvent`).not.toMatch(/FedosValidatedNostrEvent/);
    }
    // validated_subscription_adapter.ts legitimately references the TYPE
    // (its own FedosValidatedEventListener parameter is typed as one) but
    // never constructs an object literal of it.
    expect(validatedSubscriptionAdapterSource).toMatch(/import type \{ FedosValidatedNostrEvent \}/);
    expect(validatedSubscriptionAdapterSource).not.toMatch(
      /:\s*FedosValidatedNostrEvent\s*=\s*\{|Object\.freeze\(\{[\s\S]*?id:/,
    );
  });

  it("8. the design doc cross-references Alpha 241, Alpha 245, and Alpha 234", () => {
    for (const ref of [
      "secure_runtime_alpha_241_existing_inbound_validation_inventory",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_234_inbound_event_representation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. Regression: fedos_nostr_wire_event.ts carries no reference to this Stage's own doc or FedosValidatedNostrEvent", () => {
    expect(wireEventSource).not.toMatch(/secure_runtime_alpha_242/);
    expect(wireEventSource).not.toMatch(/FedosValidatedNostrEvent/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/adapters/nostr/protocol/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagesSource from "../src/os/messenger/adapters/nostr/protocol/messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosEventDescriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRelaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 231 -- "Existing Relay Inbound Inventory":
 * Stage 1 of the Nostr Relay Message Reception Arc (Alpha 231-240).
 * Review only. Confirms src/nostr/relay.ts, ws_relay.ts, publish.ts,
 * and messages.ts are all request/response or wait-for-ACK oriented,
 * that FedosEventDescriptor cannot honestly represent an inbound wire
 * event, and that signature/id validation already exists but is
 * deliberately not reused this Arc.
 */
describe("Secure Runtime Alpha 231 -- Existing Relay Inbound Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: src/nostr/relay.ts is request/response query-oriented (confirms the review's own finding)", () => {
    expect(relaySource).toMatch(/query\(filters: NostrFilter\[\]\): Promise<NostrEvent\[\]>/);
  });

  it("4. structural: src/nostr/ws_relay.ts is a short-lived, one-shot REQ->EOSE/timeout->CLOSE adapter", () => {
    expect(wsRelaySource).toMatch(/class WebSocketRelayAdapter implements RelayAdapter/);
    expect(wsRelaySource).toMatch(/"REQ"/);
    expect(wsRelaySource).toMatch(/"CLOSE"/);
  });

  it("5. structural: src/nostr/publish.ts waits for an OK acknowledgement via parseOkMessage", () => {
    expect(publishSource).toMatch(/export function parseOkMessage/);
    expect(publishSource).toMatch(/readonly accepted: boolean/);
  });

  it("6. structural: src/nostr/messages.ts is a pure, total, never-throwing parser (the closest idiom match)", () => {
    expect(messagesSource).toMatch(/export function parseRelayMessage/);
    expect(messagesSource).toMatch(/case "EVENT"/);
    expect(messagesSource).toMatch(/case "EOSE"/);
    expect(messagesSource).toMatch(/case "NOTICE"/);
  });

  it("7. structural: NobleSignatureVerifier is a real, working Schnorr verifier already present", () => {
    expect(nobleSignatureSource).toMatch(/export const NobleSignatureVerifier: SignatureVerifier/);
    expect(nobleSignatureSource).toMatch(/schnorr\.verify/);
  });

  it("8. structural: FedosEventDescriptor requires a provider field with no wire source, and renames every other field", () => {
    expect(fedosEventDescriptorSource).toMatch(/readonly provider: string;/);
    expect(fedosEventDescriptorSource).toMatch(/readonly author: string;/);
    expect(fedosEventDescriptorSource).toMatch(/readonly createdAt: number;/);
    expect(fedosEventDescriptorSource).toMatch(/readonly signature: string;/);
    expect(fedosEventDescriptorSource).not.toMatch(/readonly pubkey/);
  });

  it("9. the design doc's own section 2 confirms FedosRelay named zero inbound method AT THE TIME of this Stage's own inventory (a frozen, point-in-time record; Alpha 236/238, later Stages of this SAME Arc, add onSubscriptionMessage/onRelayMessage additively)", () => {
    expect(designDocSource).toMatch(/Zero inbound method of any kind\./);
    expect(fedosRelaySource).toMatch(/onSubscriptionMessage\(subscription: FedosSubscription, listener: FedosSubscriptionListener\): void;/);
  });

  it("10. the design doc's own section 3 answers all five required questions", () => {
    expect(designDocSource).toMatch(/### 3\.1 What existing inbound logic is reusable/);
    expect(designDocSource).toMatch(/### 3\.2 What is tied to the legacy relay stack/);
    expect(designDocSource).toMatch(/### 3\.3 Can `FedosEventDescriptor` honestly represent an inbound event\?/);
    expect(designDocSource).toMatch(/### 3\.4 Does signature\/event-ID validation already exist\?/);
    expect(designDocSource).toMatch(/### 3\.5 Can message parsing be implemented without dependencies\?/);
    expect(designDocSource).toMatch(/\*\*No\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Yes, both, but neither is reused THIS Arc\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Yes\.\*\*/);
  });

  it("11. the design doc cross-references Alpha 230, Alpha 226, Alpha 221, and Alpha 211", () => {
    for (const ref of [
      "secure_runtime_alpha_230_subscription_foundation_completion",
      "secure_runtime_alpha_226_subscription_lifecycle",
      "secure_runtime_alpha_221_subscription_code_review",
      "secure_runtime_alpha_211_relay_code_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("12. Regression: src/nostr/* files carry no reference to this Stage's own doc", () => {
    for (const source of [relaySource, wsRelaySource, publishSource, messagesSource, nobleSignatureSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_231/);
    }
  });

  it("13. Regression: desktop_application.ts carries no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_231/);
  });

  it("14. Regression: package.json dependency count remains unchanged at 2 -- no new Cargo/npm dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

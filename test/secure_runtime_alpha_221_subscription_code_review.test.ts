import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_221_subscription_code_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/nostr/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/nostr/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagesSource from "../src/nostr/messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRelaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 221 -- "Existing Subscription Code Review":
 * Stage 1 of the Nostr Subscription Foundation Arc (Alpha 221-230).
 * Review only. Confirms src/nostr/relay.ts, ws_relay.ts, and
 * messages.ts are request/response and inbound-message-parsing
 * oriented, wider or narrower than this Arc's own scope, and decides a
 * new, minimal, Desktop-owned Subscription boundary -- additive to the
 * existing FedosRelay -- is required.
 */
describe("Secure Runtime Alpha 221 -- Existing Subscription Code Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: src/nostr/relay.ts's own NostrFilter names a wider field set than this Arc's own minimum", () => {
    expect(relaySource).toMatch(/export interface NostrFilter/);
    expect(relaySource).toMatch(/"#e"\?: string\[\];/);
    expect(relaySource).toMatch(/"#p"\?: string\[\];/);
  });

  it("4. structural: src/nostr/ws_relay.ts sends REQ and CLOSE inside its own short-lived query() contract", () => {
    expect(wsRelaySource).toMatch(/"REQ"/);
    expect(wsRelaySource).toMatch(/"CLOSE"/);
    expect(wsRelaySource).toMatch(/class WebSocketRelayAdapter implements RelayAdapter/);
  });

  it("5. structural: src/nostr/messages.ts parses EVENT/EOSE/NOTICE -- inbound processing this Arc's own Goals list never names", () => {
    expect(messagesSource).toMatch(/case "EVENT"/);
    expect(messagesSource).toMatch(/case "EOSE"/);
  });

  it("6. structural: FedosRelay (pre-existing, Alpha 212-216) has no Subscription-shaped method yet, at the point this Stage reviews it", () => {
    expect(fedosRelaySource).toMatch(/publish\(event: FedosEventDescriptor\): Promise<void>;/);
  });

  it("7. the design doc's own Decision section names the additive extension approach and all new symbols", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toContain("`FedosSubscription`");
    expect(section).toContain("`FedosSubscriptionFilter`");
    expect(section).toContain("`buildReqMessage`");
    expect(section).toContain("`buildCloseMessage`");
  });

  it("8. the design doc cross-references Alpha 220, Alpha 219, Alpha 211, and Alpha 212", () => {
    for (const ref of [
      "secure_runtime_alpha_220_relay_foundation_completion",
      "secure_runtime_alpha_219_relay_extensibility_review",
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_212_relay_interface",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. Regression: src/nostr/relay.ts, ws_relay.ts, and messages.ts carry no reference to this Stage's own doc", () => {
    for (const source of [relaySource, wsRelaySource, messagesSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_221/);
    }
  });

  it("10. Regression: desktop_application.ts, create_runtime.ts/types.ts/worker.ts carry no reference to this Stage's own doc", () => {
    for (const source of [desktopApplicationSource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_221/);
    }
  });

  it("11. Regression: package.json dependency count remains unchanged at 2 -- no new Cargo/npm dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

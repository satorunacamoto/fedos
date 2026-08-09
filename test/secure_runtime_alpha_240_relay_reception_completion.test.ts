import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_240_relay_reception_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import parserSource from "../src/desktop/relay_inbound_parser.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyRelaySource from "../src/nostr/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyWsRelaySource from "../src/nostr/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyPublishSource from "../src/nostr/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyMessagesSource from "../src/nostr/messages.ts?raw";

const RUNTIME_WORKER_DESKTOP_FILES: Record<string, string> = {
  "create_runtime.ts": createRuntimeSource,
  "types.ts": runtimeTypesSource,
  "worker.ts": workerSource,
  "desktop_application.ts": desktopApplicationSource,
  "create_desktop_application.ts": createDesktopApplicationSource,
};

/**
 * Secure Runtime Alpha 240 -- "Relay Message Reception Completion":
 * Stage 10, the closing Stage, of the Nostr Relay Message Reception
 * Arc (Alpha 231-240). Adds no further production code. Declares the
 * Arc's own Objective confirmed complete and recommends exactly one
 * next Arc.
 */
describe("Secure Runtime Alpha 240 -- Relay Message Reception Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it makes NO further code change/);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE,/);
  });

  it("4. the design doc's own Completion Declaration lists all five still-out-of-scope items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**Cryptographic validation of received Events, unless safely reused",
      "**Relay Pool, deduplication across Relays**",
      "**Automatic reconnect, backoff, persistent subscriptions, storage**",
      "**DM, NIP-42 authentication, NIP-46, NIP-05, GUI**",
      "**A public Runtime/`AppRuntime` API for inbound Relay messages**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Inbound Event Validation Arc", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Nostr Inbound Event Validation Arc\.\*\*/);
    expect(section).toMatch(/Relay Pool must not be recommended until a single Relay\s*\ncan receive/);
  });

  it("6. the design doc cross-references all nine prior Stages of this Arc plus Alpha 230", () => {
    for (const ref of [
      "secure_runtime_alpha_239_inbound_lifecycle_verification",
      "secure_runtime_alpha_238_ok_notice_handling",
      "secure_runtime_alpha_237_eose_lifecycle",
      "secure_runtime_alpha_236_subscription_event_delivery",
      "secure_runtime_alpha_235_websocket_inbound_wiring",
      "secure_runtime_alpha_234_inbound_event_representation",
      "secure_runtime_alpha_233_nip01_relay_wire_parser",
      "secure_runtime_alpha_232_relay_inbound_message_model",
      "secure_runtime_alpha_231_existing_relay_inbound_inventory",
      "secure_runtime_alpha_230_subscription_foundation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("7. structural: FedosRelay's final shape contains every frozen method plus the two new listener-registration methods", () => {
    expect(relaySource).toMatch(/connect\(\): Promise<void>;/);
    expect(relaySource).toMatch(/disconnect\(\): Promise<void>;/);
    expect(relaySource).toMatch(/isConnected\(\): boolean;/);
    expect(relaySource).toMatch(/publish\(event: FedosEventDescriptor\): Promise<void>;/);
    expect(relaySource).toMatch(/subscribe\(filters: readonly FedosSubscriptionFilter\[\]\): Promise<FedosSubscription>;/);
    expect(relaySource).toMatch(/unsubscribe\(subscription: FedosSubscription\): Promise<void>;/);
    expect(relaySource).toMatch(/onSubscriptionMessage\(subscription: FedosSubscription, listener: FedosSubscriptionListener\): void;/);
    expect(relaySource).toMatch(/onRelayMessage\(listener: FedosRelayMessageListener\): void;/);
  });

  it("8. structural: package.json carries no reference to any of the ten Arc-stage docs -- zero dependency change", () => {
    for (let stage = 231; stage <= 240; stage++) {
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("9. structural: relay_inbound_parser.ts performs no cryptographic verification of any kind", () => {
    const codeOnly = parserSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/schnorr|NobleSignatureVerifier|verifyEventId/);
  });

  it("10. structural: the four legacy src/nostr files are completely untouched by this Arc", () => {
    for (const source of [legacyRelaySource, legacyWsRelaySource, legacyPublishSource, legacyMessagesSource]) {
      for (let stage = 231; stage <= 240; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosRelayInboundMessage|parseRelayInboundMessage|FedosNostrWireEvent/);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten Stages, plus everything else
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 231-240 docs or the new inbound symbols", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      for (let stage = 231; stage <= 240; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosRelayInboundMessage|onSubscriptionMessage|onRelayMessage/);
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched by this Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 231; stage <= 240; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosRelayInboundMessage|onSubscriptionMessage|onRelayMessage/);
    }
  });

  it("13. Regression: zero reference to any inbound Relay symbol across all five Runtime/Worker/Desktop files", () => {
    const INBOUND_SYMBOLS = [
      "FedosRelayInboundMessage",
      "parseRelayInboundMessage",
      "FedosNostrWireEvent",
      "FedosSubscriptionListener",
      "FedosRelayMessageListener",
    ];
    for (const [name, source] of Object.entries(RUNTIME_WORKER_DESKTOP_FILES)) {
      for (const symbol of INBOUND_SYMBOLS) {
        expect(source, `${name} should not reference ${symbol}`).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      }
    }
  });

  it("14. Regression: WebSocketRelay/NullRelay never reference src/nostr/ws_relay.ts's own RelaySocketLike/WebSocketFactory types", () => {
    expect(websocketRelaySource).not.toMatch(/RelaySocketLike|from ".*nostr\/ws_relay\.js"/);
    expect(nullRelaySource).not.toMatch(/from ".*websocket_relay\.js"/);
  });
});

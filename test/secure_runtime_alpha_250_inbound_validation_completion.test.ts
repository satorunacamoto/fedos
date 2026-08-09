import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_250_inbound_validation_completion.md?raw";
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
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRelaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyEventSource from "../src/nostr/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyNobleSignatureSource from "../src/nostr/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedEventTypeSource from "../src/desktop/fedos_validated_nostr_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import idVerifierSource from "../src/desktop/nostr_event_id_verifier.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sigVerifierSource from "../src/desktop/nostr_signature_verifier.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import combinedValidatorSource from "../src/desktop/combined_inbound_event_validator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/desktop/validated_subscription_adapter.ts?raw";

const RUNTIME_WORKER_DESKTOP_FILES: Record<string, string> = {
  "create_runtime.ts": createRuntimeSource,
  "types.ts": runtimeTypesSource,
  "worker.ts": workerSource,
  "desktop_application.ts": desktopApplicationSource,
  "create_desktop_application.ts": createDesktopApplicationSource,
};

const NEW_ARC_FILES: Record<string, string> = {
  "fedos_validated_nostr_event.ts": validatedEventTypeSource,
  "nostr_event_id_verifier.ts": idVerifierSource,
  "nostr_signature_verifier.ts": sigVerifierSource,
  "combined_inbound_event_validator.ts": combinedValidatorSource,
  "validated_subscription_adapter.ts": adapterSource,
};

/**
 * Secure Runtime Alpha 250 -- "Inbound Validation Completion": Stage
 * 10, the closing Stage, of the Nostr Inbound Event Validation Arc
 * (Alpha 241-250). Adds no further production code. Declares the
 * Arc's own Objective confirmed complete and recommends exactly one
 * next Arc.
 */
describe("Secure Runtime Alpha 250 -- Inbound Validation Completion", () => {
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
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all eight now-complete capabilities", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**Inbound structural parsing**",
      "**Canonical Event ID verification**",
      "**BIP-340 signature verification**",
      "**Validated-event type boundary**",
      "**Fail-closed invalid-event handling**",
      "**Subscription-scoped validated delivery**",
      "**Listener exception isolation**",
      "**Transport/validation/consumer separation**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc's own Completion Declaration lists all four still-out-of-scope items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**Relay Pool, cross-relay deduplication**",
      "**Persistent storage, moderation, deletion semantics, replaceable",
      "**DM, NIP-42, NIP-05, NIP-46**",
      "**Automatic reconnect, GUI**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("6. the design doc names exactly one recommended next Arc: Canonical Board Model Foundation Arc", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Canonical Board Model Foundation\s*\nArc\.\*\*/);
    expect(section).not.toMatch(/Relay Pool Arc/);
  });

  it("7. the design doc cross-references all nine prior Stages of this Arc plus Alpha 240", () => {
    for (const ref of [
      "secure_runtime_alpha_249_relay_validation_integration",
      "secure_runtime_alpha_248_known_answer_tamper_verification",
      "secure_runtime_alpha_247_validation_failure_semantics",
      "secure_runtime_alpha_246_validated_subscription_delivery",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_244_bip340_signature_verification",
      "secure_runtime_alpha_243_canonical_event_id_verification",
      "secure_runtime_alpha_242_validated_nostr_event_model",
      "secure_runtime_alpha_241_existing_inbound_validation_inventory",
      "secure_runtime_alpha_240_relay_reception_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("8. structural: FedosValidatedNostrEvent carries the same seven NIP-01 wire fields, all readonly", () => {
    expect(validatedEventTypeSource).toMatch(/readonly id: string;/);
    expect(validatedEventTypeSource).toMatch(/readonly pubkey: string;/);
    expect(validatedEventTypeSource).toMatch(/readonly created_at: number;/);
    expect(validatedEventTypeSource).toMatch(/readonly kind: number;/);
    expect(validatedEventTypeSource).toMatch(/readonly tags: readonly \(readonly string\[\]\)\[\];/);
    expect(validatedEventTypeSource).toMatch(/readonly content: string;/);
    expect(validatedEventTypeSource).toMatch(/readonly sig: string;/);
    const interfaceBody = (validatedEventTypeSource.match(/export interface FedosValidatedNostrEvent \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(interfaceBody.length).toBeGreaterThan(0);
    expect(interfaceBody).not.toMatch(/valid|verified|status/i);
  });

  it("9. structural: package.json carries no reference to any of the ten Arc-stage docs -- zero dependency change", () => {
    for (let stage = 241; stage <= 250; stage++) {
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("10. structural: none of the five Arc-owned files reference src/nostr/* or src/sign/*", () => {
    for (const [name, source] of Object.entries(NEW_ARC_FILES)) {
      expect(source, name).not.toMatch(/from ".*\/(nostr|sign)\//);
    }
  });

  it("11. structural: the legacy src/nostr files are completely untouched by this Arc", () => {
    for (const source of [legacyEventSource, legacyNobleSignatureSource]) {
      for (let stage = 241; stage <= 250; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosValidatedNostrEvent|validateInboundNostrEvent|createValidatedEventListener/);
    }
  });

  it("12. structural: websocket_relay.ts, fedos_relay.ts, and null_relay.ts carry zero reference to any Arc symbol", () => {
    for (const source of [websocketRelaySource, fedosRelaySource, nullRelaySource]) {
      expect(source).not.toMatch(/FedosValidatedNostrEvent|validateInboundNostrEvent|createValidatedEventListener|verifyNostrEventId|verifyNostrEventSignature/);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten Stages, plus everything else
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 241-250 docs or the new validation symbols", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      for (let stage = 241; stage <= 250; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosValidatedNostrEvent|validateInboundNostrEvent|createValidatedEventListener/);
    }
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched by this Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 241; stage <= 250; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosValidatedNostrEvent|validateInboundNostrEvent|createValidatedEventListener/);
    }
  });

  it("15. Regression: zero reference to any Arc validation symbol across all five Runtime/Worker/Desktop files", () => {
    const VALIDATION_SYMBOLS = [
      "FedosValidatedNostrEvent",
      "verifyNostrEventId",
      "verifyNostrEventSignature",
      "validateInboundNostrEvent",
      "createValidatedEventListener",
    ];
    for (const [name, source] of Object.entries(RUNTIME_WORKER_DESKTOP_FILES)) {
      for (const symbol of VALIDATION_SYMBOLS) {
        expect(source, `${name} should not reference ${symbol}`).not.toMatch(new RegExp(`\\b${symbol}\\b`));
      }
    }
  });

  it("16. Regression: zero console.* call anywhere across the five Arc-owned files (reconfirmed at Arc close)", () => {
    for (const [name, source] of Object.entries(NEW_ARC_FILES)) {
      expect(source, name).not.toMatch(/console\./);
    }
  });
});

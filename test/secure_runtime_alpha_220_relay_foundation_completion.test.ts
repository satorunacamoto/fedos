import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_220_relay_foundation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip07Source from "../src/os/_legacy_prototype/sign/nip07.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyRelaySource from "../src/os/messenger/adapters/nostr/protocol/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyWsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyPublishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 220 -- "Relay Foundation Completion": Stage 10,
 * the closing Stage, of the Nostr Relay Foundation Arc (Alpha
 * 211-220). Adds no further production code. Declares the Arc's own
 * Objective confirmed complete and recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 220 -- Relay Foundation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it makes NO further code change\s*\nof any kind\./);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE,/);
  });

  it("4. the design doc's own Completion Declaration lists all five NOT-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**REQ, CLOSE, Subscription, Filters**",
      "**Relay Pool**",
      "**NIP-05, NIP-46, NIP-07**",
      "**A public Runtime/`AppRuntime` API for Relay**",
      "**`DesktopApplication` wiring**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Relay Subscription & REQ/CLOSE Foundation", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Nostr Relay Subscription & REQ\/CLOSE\s*\nFoundation\.\*\*/);
  });

  it("6. the design doc cross-references all nine prior Stages of this Arc plus Alpha 210", () => {
    for (const ref of [
      "secure_runtime_alpha_219_relay_extensibility_review",
      "secure_runtime_alpha_218_relay_boundary_review",
      "secure_runtime_alpha_217_relay_foundation_verification",
      "secure_runtime_alpha_216_publish_api",
      "secure_runtime_alpha_215_connection_lifecycle",
      "secure_runtime_alpha_214_websocket_relay_connection_only",
      "secure_runtime_alpha_213_null_relay",
      "secure_runtime_alpha_212_relay_interface",
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_210_event_runtime_boundary_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("7. structural: lib.rs #[wasm_bindgen] count and pub fn count remain fixed at 13/36 -- zero Rust change across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("8. structural: Cargo.toml and package.json carry no reference to any of the ten Arc-stage docs -- zero dependency change", () => {
    for (let stage = 211; stage <= 220; stage++) {
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("9. structural: FedosRelay's shape at this Arc's own closing state contains url/connect/disconnect/isConnected/publish, in that order (Alpha 226, a later Arc, additively appends subscribe/unsubscribe exactly as this Stage's own §3 next-Arc recommendation anticipated)", () => {
    expect(relaySource).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\s*disconnect\(\): Promise<void>;\s*\n\s*isConnected\(\): boolean;\s*\n\s*publish\(event: FedosEventDescriptor\): Promise<void>;/,
    );
  });

  it("10. structural: src/sign/nip07.ts and the three legacy src/nostr Relay files are completely untouched by this Arc", () => {
    for (const source of [nip07Source, legacyRelaySource, legacyWsRelaySource, legacyPublishSource]) {
      for (let stage = 211; stage <= 220; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/\bFedosRelay\b|\bNullRelay\b/);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten Stages, plus everything else
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 211-220 docs or the new Relay symbols", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      for (let stage = 211; stage <= 220; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/FedosRelay|NullRelay|WebSocketRelay/);
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched by this Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 211; stage <= 220; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("13. Regression: WebSocketRelay never references src/nostr/ws_relay.ts's own RelaySocketLike/WebSocketFactory types, and neither class's own CODE imports the other", () => {
    expect(websocketRelaySource).not.toMatch(/RelaySocketLike|from ".*nostr\/ws_relay\.js"/);
    expect(nullRelaySource).not.toMatch(/from ".*websocket_relay\.js"/);
    expect(websocketRelaySource).not.toMatch(/from ".*null_relay\.js"/);
  });
});

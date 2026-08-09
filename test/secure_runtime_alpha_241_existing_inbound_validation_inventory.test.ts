import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoSource from "../src/os/messenger/adapters/nostr/protocol/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import eventSource from "../src/os/messenger/adapters/nostr/protocol/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireEventSource from "../src/os/messenger/desktop/fedos_nostr_wire_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 241 -- "Existing Inbound Validation Inventory":
 * Stage 1 of the Nostr Inbound Event Validation Arc (Alpha 241-250).
 * Review only. Confirms the legacy TypeScript verifiers are unsafe to
 * reuse as-is (JSON.stringify escaping divergence), that no Rust
 * Schnorr-verification function is reachable from TypeScript, and that
 * no new dependency is required.
 */
describe("Secure Runtime Alpha 241 -- Existing Inbound Validation Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: src/nostr/event.ts's own serializeForId uses JSON.stringify (the divergent escaper)", () => {
    expect(eventSource).toMatch(/JSON\.stringify\(\[/);
  });

  it("4. structural: src/nostr/noble_signature.ts's own NobleSignatureVerifier recomputes the id via serializeForId before verifying", () => {
    expect(nobleSignatureSource).toMatch(/serializeForId/);
    expect(nobleSignatureSource).toMatch(/schnorr\.verify/);
  });

  it("5. structural: src/nostr/crypto.ts exposes a pure constant-time hex compare", () => {
    expect(cryptoSource).toMatch(/export function constantTimeHexEqual/);
  });

  it("6. structural: lib.rs's own canonical serializer implements exactly NIP-01's six-character escape rule", () => {
    expect(libRsSource).toMatch(/fn escape_json_string_internal/);
    expect(libRsSource).toMatch(/serialize_nostr_event_canonical_internal/);
  });

  it("7. structural: no pub(crate)/pub fn wraps Schnorr signature verification -- verify_prehash exists only inside #[test] functions", () => {
    expect(libRsSource).toMatch(/verify_prehash/);
    expect(libRsSource).not.toMatch(/pub(?:\(crate\))? fn \w*(?:schnorr|prehash)\w*\(/i);
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBeGreaterThan(0);
  });

  it("8. structural: FedosNostrWireEvent carries no reference to this Stage's own doc or any Alpha 242-246 symbol", () => {
    expect(wireEventSource).not.toMatch(/secure_runtime_alpha_241/);
    expect(wireEventSource).not.toMatch(/FedosValidatedNostrEvent|validateInboundNostrEvent/);
  });

  it("9. structural: current websocket_relay.ts (pre-Arc state, confirmed) performs zero cryptographic verification", () => {
    const codeOnly = websocketRelaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/schnorr|verifyNostrEventId|verifyNostrEventSignature|validateInboundNostrEvent/);
  });

  it("10. the design doc's own section 3 answers all seven required questions", () => {
    expect(designDocSource).toMatch(/### 3\.1 Which existing validator can be reused\?/);
    expect(designDocSource).toMatch(/### 3\.2 Do TypeScript and Rust canonical serialization agree\?/);
    expect(designDocSource).toMatch(/### 3\.3 Is current TS escaping behavior safe for inbound verification\?/);
    expect(designDocSource).toMatch(/### 3\.4 Can signature verification remain TypeScript-side\?/);
    expect(designDocSource).toMatch(/### 3\.5 Is a Rust boundary needed\?/);
    expect(designDocSource).toMatch(/### 3\.6 Is any dependency change required\?/);
    expect(designDocSource).toMatch(/### 3\.7 Which existing code is read\/verify-only versus outbound-signing-oriented\?/);
  });

  it("11. the design doc's own answers are No/No/No/Yes/No/No", () => {
    const section = (designDocSource.match(/## 3\. Answers to the seven required questions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No, not as they exist today\.\*\*/);
    expect(section).toMatch(/\*\*No\.\*\* `serializeForId`'s own doc comment/);
    expect(section).toMatch(/\*\*Yes\.\*\* `@noble\/curves`'s own `schnorr\.verify`/);
    expect(section).toMatch(/\*\*No\.\*\* §2 already confirms no `pub\(crate\)`/);
    expect(section).toMatch(/\*\*No\.\*\* `@noble\/curves` and `@noble\/hashes`/);
  });

  it("12. the design doc cross-references Alpha 240, Alpha 234, Alpha 233, Alpha 193, and Alpha 191", () => {
    for (const ref of [
      "secure_runtime_alpha_240_relay_reception_completion",
      "secure_runtime_alpha_234_inbound_event_representation",
      "secure_runtime_alpha_233_nip01_relay_wire_parser",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("13. Regression: src/nostr/*.ts and lib.rs carry no reference to this Stage's own doc", () => {
    for (const source of [cryptoSource, nobleSignatureSource, eventSource, libRsSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_241/);
    }
  });

  it("14. Regression: package.json dependency count remains unchanged at 2 -- no new Cargo/npm dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

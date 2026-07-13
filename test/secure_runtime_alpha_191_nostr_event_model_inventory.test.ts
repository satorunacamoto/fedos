import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_191_nostr_event_model_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrEventSource from "../src/nostr/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/nostr/types.ts?raw";

/**
 * Secure Runtime Alpha 191 -- "Nostr Event Model Inventory": Stage 1
 * of the Nostr Event Foundation Arc (Alpha 191-200). DESIGN/DECISION
 * ONLY -- zero code change. Reviews NIP-01's own event shape and
 * canonical serialization rule, the existing TypeScript implementation,
 * and decides the minimal Rust-side representation.
 */
describe("Secure Runtime Alpha 191 -- Nostr Event Model Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN/DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc quotes NIP-01's own six-character escape list precisely", () => {
    const section = (designDocSource.match(/## 2\. NIP-01's own event shape and canonical serialization rule([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const escape of ["\\n", "\\\"", "\\\\", "\\r", "\\t", "\\b", "\\f"]) {
      expect(section).toContain(escape);
    }
    expect(section).toContain("[0, <pubkey>, <created_at>, <kind>, <tags>, <content>]");
  });

  it("4. the design doc identifies the JSON.stringify escaping divergence as acceptable for verify but wrong for outbound signing", () => {
    const section = (designDocSource.match(/## 3\. What already exists([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/harmless for VERIFYING/);
    expect(section).toMatch(/would be WRONG for an OUTBOUND signer/);
  });

  it("5. the design doc's minimal representation table names all five EventCore fields with their chosen Rust types", () => {
    const section = (designDocSource.match(/## 5\. The minimal canonical event representation this Arc adopts([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toContain("`FedosNostrPublicKeyHex`");
    expect(section).toMatch(/`created_at`\s*\|\s*`u64`/);
    expect(section).toMatch(/`kind`\s*\|\s*`u64`/);
    expect(section).toMatch(/`tags`\s*\|\s*`Vec<Vec<String>>`/);
    expect(section).toMatch(/`content`\s*\|\s*`String`/);
  });

  it("6. the design doc explicitly excludes id/sig as computed outputs, not Handle fields", () => {
    const section = (designDocSource.match(/## 5\. The minimal canonical event representation this Arc adopts([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/`id` and `sig` are deliberately NOT fields of `FedosNostrEventHandle`/);
  });

  it("7. the design doc cross-references Alpha 190, 187, 173, and event.ts", () => {
    for (const ref of [
      "secure_runtime_alpha_190_schnorr_signing_foundation_completion",
      "secure_runtime_alpha_187_event_builder_compatibility_review",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "src/nostr/event.ts",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("8. structural: src/nostr/event.ts still implements serializeForId/computeEventId/verifyEventId exactly as described", () => {
    expect(nostrEventSource).toMatch(/export function serializeForId\(event: EventCore\): string/);
    expect(nostrEventSource).toMatch(/JSON\.stringify\(\[\s*\n\s*0,/);
    expect(nostrEventSource).toMatch(/export async function computeEventId/);
    expect(nostrEventSource).toMatch(/export async function verifyEventId/);
  });

  it("9. structural: NostrEvent's own seven fields are unchanged, kind/created_at remain unbounded numbers", () => {
    expect(nostrTypesSource).toMatch(/readonly id: string;/);
    expect(nostrTypesSource).toMatch(/readonly pubkey: string;/);
    expect(nostrTypesSource).toMatch(/readonly created_at: number;/);
    expect(nostrTypesSource).toMatch(/readonly kind: number;/);
    expect(nostrTypesSource).toMatch(/readonly sig: string;/);
  });

  it("10. structural: this Stage's own §5 decision (FedosNostrEventHandle, five EventCore fields, id/sig excluded) is exactly what Alpha 192-195 (the SAME Arc's own later Stages) build -- confirming the inventory's own recommendation was followed, not silently revised", () => {
    expect(libRsSource).toMatch(/struct\s+FedosNostrEventHandle \{/);
    const structBody = (libRsSource.match(/struct\s+FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
    expect(structBody).toMatch(/pubkey: nostr_identifier_encoding::FedosNostrPublicKeyHex,/);
    expect(structBody).toMatch(/created_at: u64,/);
    expect(structBody).toMatch(/kind: u64,/);
    expect(structBody).toMatch(/tags: Vec<Vec<String>>,/);
    expect(structBody).toMatch(/content: String,/);
    expect(structBody).not.toMatch(/\bid\b|\bsig\b/);
  });

  it("11. structural: serde_json remains dev-dependencies-only, no production JSON library exists", () => {
    const devDepsSection = (cargoTomlSource.match(/^\[dev-dependencies\]$([\s\S]*)/m) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^serde_json = /m);
    const prodDepsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(prodDepsSection).not.toMatch(/^serde_json/m);
    expect(prodDepsSection).not.toMatch(/^serde\s*=/m);
  });

  it("12. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: lib.rs, event.ts, and types.ts carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_191/);
    expect(nostrEventSource).not.toMatch(/secure_runtime_alpha_191/);
    expect(nostrTypesSource).not.toMatch(/secure_runtime_alpha_191/);
  });

  it("14. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_191/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

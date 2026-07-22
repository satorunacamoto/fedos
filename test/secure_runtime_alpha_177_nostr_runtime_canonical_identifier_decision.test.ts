import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityDescriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";

/**
 * Secure Runtime Alpha 177 -- "Nostr Runtime Canonical Identifier
 * Decision": Stage 2 of the Nostr Public Identifier Runtime Boundary
 * Arc (Alpha 176-180). DESIGN/DECISION ONLY -- zero code change.
 * Formally adopts hex as the Runtime-internal canonical identifier
 * form, leaving npub fully available for Desktop display (Alpha 178).
 */
describe("Secure Runtime Alpha 177 -- Nostr Runtime Canonical Identifier Decision", () => {
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

  it("3. the design doc scopes 'Runtime canonical' precisely -- in scope vs. not in scope", () => {
    const section = (designDocSource.match(/## 2\. Scope([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*In scope\*\*/);
    expect(section).toMatch(/\*\*NOT in scope, and NOT changed\*\*/);
    expect(section).toContain("Alpha 172's own Option C decision");
    expect(section).toContain("Alpha 176 §6 confirmed");
  });

  it("4. the design doc's comparison table covers all seven named criteria", () => {
    const section = (designDocSource.match(/## 3\. Comparison([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const criterion of [
      "`NostrEvent.pubkey` shape",
      "NIP-01 relay `authors` filter",
      "NIP-19's own stated purpose",
      "Byte-length stability",
      "Precedent inside this crate",
      "Decoder need if chosen",
      "Cross-protocol precedent",
    ]) {
      expect(section).toContain(criterion);
    }
  });

  it("5. the design doc formally adopts hex as Runtime-internal canonical, without reducing npub's status", () => {
    expect(designDocSource).toMatch(
      /\*\*`FedosNostrPublicKeyHex` \(lowercase, 64-character hex\) is ADOPTED as\s*\nthe Runtime-internal canonical representation/,
    );
    expect(designDocSource).toMatch(
      /\*\*`npub` remains fully available, unchanged, unreduced in status/,
    );
  });

  it("6. the design doc explicitly separates Runtime-canonical from Desktop-display, deferring Desktop to Alpha 178", () => {
    const section = (designDocSource.match(/## 5\. Desktop formatting may differ([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/binds ONLY the Runtime-internal/);
    expect(section).toMatch(/Alpha 178\s*\nreviews/);
  });

  it("7. the design doc cross-references Alpha 176, 175, 172, and 171", () => {
    for (const ref of [
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
      "secure_runtime_alpha_175_nostr_public_identifier_completion",
      "secure_runtime_alpha_172_nostr_identifier_representation_decision",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("8. structural: FedosNostrPublicKeyHex and FedosNostrNpub both still exist, neither removed", () => {
    expect(libRsSource).toMatch(/struct\s+FedosNostrPublicKeyHex\b/);
    expect(libRsSource).toMatch(/struct\s+FedosNostrNpub\b/);
  });

  it("9. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(48);
  });

  it("10. structural: FedosIdentityDescriptor is untouched by this Stage's own canonical choice", () => {
    const body = (identityDescriptorSource.match(/export interface FedosIdentityDescriptor \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["id", "provider", "publicIdentifier", "displayName", "avatar"]);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_177/);
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_177/);
    }
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_177/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_177/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

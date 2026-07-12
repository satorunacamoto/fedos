import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_172_nostr_identifier_representation_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 172 -- "Nostr Public Identifier Representation
 * Decision": Stage 2 of the Nostr Public Identifier Encoding Arc. A
 * DESIGN/DECISION ONLY Stage -- zero code change. Compares Options A-E and
 * adopts Option C (hex and npub, separate dedicated types).
 */
describe("Secure Runtime Alpha 172 -- Nostr Public Identifier Representation Decision", () => {
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

  it("3. the design doc compares all five named options A-E", () => {
    const section = (designDocSource.match(/## 2\. Options compared([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const label of [
      "hex only",
      "npub only",
      "hex and npub, separate dedicated types",
      "Single `String`-typed value, mixed by convention",
      "Treat the Public Key Handle itself as the Identifier",
    ]) {
      expect(section).toContain(label);
    }
  });

  it("4. the design doc adopts Option C explicitly", () => {
    expect(designDocSource).toMatch(
      /\*\*Option C — generate BOTH `hex` and `npub`, each in its own dedicated\s*\ntype \(`FedosNostrPublicKeyHex`, `FedosNostrNpub`\) — is adopted,/,
    );
  });

  it("5. the design doc rejects Option D for free string mixing and Option E for providing no Encoder Boundary", () => {
    expect(designDocSource).toMatch(/Option D is REJECTED outright/);
    expect(designDocSource).toMatch(/Option E is REJECTED outright/);
  });

  it("6. the design doc scopes both types to internal, pub(crate)-only value types, not yet exposed", () => {
    const section = (designDocSource.match(/## 5\. Scope: internal value types only, not yet exposed([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toContain("`pub(crate)` Rust");
    expect(section).toMatch(/is `#\[wasm_bindgen\]`-\s*\nannotated/);
  });

  it("7. the design doc's own Protocol Extensibility framing forbids consolidating codecs across protocols", () => {
    const section = (designDocSource.match(/\| Future Session\/ATProto separation \|([\s\S]*?)\n\n/) ?? [])[0] ?? "";
    expect(section).toMatch(/never these two reused/);
  });

  it("8. the design doc cross-references Alpha 171 and Alpha 167", () => {
    for (const ref of [
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
      "secure_runtime_alpha_167_nostr_public_key_representation_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("9. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_172/);
  });

  it("10. Regression: no FedosNostrIdentifier-shaped single-type exists -- Option D was rejected, not silently implemented", () => {
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrIdentifier\b/);
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrPublicIdentifier\b/);
  });

  it("11. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_172/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_172/);
  });

  it("12. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_172/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_172/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

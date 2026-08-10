import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/os/messenger/adapters/nostr/protocol/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 171 -- "Existing Nostr Identifier / Bech32
 * Inventory": Stage 1 of the Nostr Public Identifier Encoding Arc. A
 * DESIGN/DECISION ONLY Stage -- zero code change. Inventories the
 * existing (nonexistent) npub/nsec/Bech32/hex-encoder surface.
 */
describe("Secure Runtime Alpha 171 -- Existing Nostr Identifier Inventory", () => {
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

  it("3. the design doc's own seven required questions are all answered, and confirms no new dependency is needed", () => {
    const section = (designDocSource.match(/## 3\. Answers to the seven required questions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    for (let i = 1; i <= 7; i++) {
      expect(section).toMatch(new RegExp(`${i}\\. \\*\\*`));
    }
    expect(section).toMatch(/No new Cargo or npm dependency is needed/);
  });

  it("4. the design doc confirms NIP-19 uses classic Bech32, never Bech32m, HRP npub, no TLV", () => {
    expect(designDocSource).toMatch(/Bech32 \(BIP-173\) — explicitly NOT Bech32m \(BIP-350\)/);
    expect(designDocSource).toMatch(/HRP `"npub"`/);
  });

  it("5. the design doc cross-references Alpha 166 and Alpha 170", () => {
    for (const ref of [
      "secure_runtime_alpha_166_existing_nostr_public_key_inventory",
      "secure_runtime_alpha_170_nostr_public_key_derivation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the inventory's own claims directly against source
  // ---------------------------------------------------------------------

  it("6. structural: no bech32/npub/nsec implementation exists in src/ -- only denylist/prohibition mentions", () => {
    expect(nostrIdentityProviderSource).toMatch(
      /NO secret key, `nsec`, seed, mnemonic, or `npub` ENCODE\/DECODE/,
    );
    expect(nostrCryptoSource).not.toMatch(/bech32|npub|nsec/i);
  });

  it("7. structural: NostrEvent.pubkey remains documented as 32-byte x-only hex, no codec added", () => {
    expect(nostrTypesSource).toMatch(
      /32-byte lowercase hex secp256k1 x-only public key of the author\./,
    );
  });

  it("8. structural: hex crate remains dev-dependencies-only, no bech32 dependency exists", () => {
    expect(cargoTomlSource).not.toMatch(/^bech32/m);
    const devDepsSection = (cargoTomlSource.match(/\[dev-dependencies\]([\s\S]*)/) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^hex = "0\.4\.3"/m);
    const depsSection = (cargoTomlSource.match(/\[dependencies\]([\s\S]*?)\[dev-dependencies\]/) ?? [])[1] ?? "";
    expect(depsSection).not.toMatch(/^hex\s*=/m);
  });

  it("9. structural: package.json declares exactly two dependencies, no bech32/scure package", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_171/);
  });

  it("11. Regression: src/nostr/* and src/identity/* carry no reference to this Stage's own doc", () => {
    expect(nostrTypesSource).not.toMatch(/secure_runtime_alpha_171/);
    expect(nostrCryptoSource).not.toMatch(/secure_runtime_alpha_171/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_171/);
  });

  it("12. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_171/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_171/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_171/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_171/);
  });
});

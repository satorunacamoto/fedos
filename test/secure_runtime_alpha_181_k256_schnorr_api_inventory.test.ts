import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import guardSource from "../packages/fedos-core-rust/src/crypto/secp256k1_dependency_guard.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 181 -- "k256 Schnorr API Inventory & Dependency
 * Decision": Stage 1 of the Nostr Schnorr Signing Foundation Arc
 * (Alpha 181-190). Inventories k256's own BIP-340 Schnorr support and
 * decides to enable k256's existing `"schnorr"` Cargo FEATURE FLAG
 * (not a new dependency) as the only way to satisfy both "reuse k256"
 * and "no manual signing implementation."
 */
describe("Secure Runtime Alpha 181 -- k256 Schnorr API Inventory & Dependency Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc inventories SigningKey/VerifyingKey/Signature as directly reusable", () => {
    const section = (designDocSource.match(/## 2\. Inventory: k256 already ships real BIP-340 Schnorr signing([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toContain("k256::schnorr::SigningKey");
    expect(section).toContain("k256::schnorr::VerifyingKey");
    expect(section).toContain("k256::schnorr::Signature");
    expect(section).toMatch(/#\[cfg\(feature = "schnorr"\)\] pub mod schnorr;/);
  });

  it("3. the design doc identifies sign_prehash's zero-aux-rand determinism from first principles", () => {
    const section = (designDocSource.match(/## 3\. The deterministic signing path([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/thirty-two ZERO bytes/);
    expect(section).toMatch(/already exactly the deterministic signing primitive/);
  });

  it("4. the design doc states the exact conflict between reuse-k256, no-new-dependency, and no-manual-signing", () => {
    const section = (designDocSource.match(/## 4\. The conflict([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/leave\s*\nexactly one path: use k256's OWN `schnorr` module/);
    expect(section).toMatch(/confirmed, by direct review with the\s*\nproject owner/);
  });

  it("5. the design doc's decision states the k256 dependency LINE COUNT is unchanged and names the exact three new transitive crates", () => {
    const section = (designDocSource.match(/## 5\. Decision and its ONE consequence([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/`\[dependencies\]` section's own LINE COUNT does not change/);
    expect(section).toContain("ecdsa v0.16.9");
    expect(section).toContain("signature v2.2.0");
    expect(section).toContain("sha2");
    expect(section).toMatch(/SAME category of reviewed,\s*\ndocumented, unavoidable transitive exception/);
  });

  it("6. the design doc cross-references Alpha 180 and the dependency adoption doc", () => {
    for (const ref of [
      "secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion",
      "nip44_dependency_adoption",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: k256's dependency line enables exactly arithmetic and schnorr, no other forbidden feature", () => {
    const k256Line = (cargoTomlSource.match(/^k256 = .*$/m) ?? [""])[0];
    expect(k256Line).toContain("default-features = false");
    expect(k256Line).toMatch(/features = \["arithmetic", "schnorr"\]/);
    for (const forbidden of ["ecdsa", "serde", "pem", "pkcs8", "\"rand\"", "\"std\"", "\"alloc\""]) {
      expect(k256Line).not.toContain(forbidden);
    }
  });

  it("8. structural: the pre-existing Stage-196 guard test now expects arithmetic+schnorr, not just arithmetic", () => {
    expect(guardSource).toContain(
      "fn k256_is_declared_with_default_features_false_and_only_arithmetic_and_schnorr_features",
    );
    expect(guardSource).toMatch(/features = \["arithmetic", "schnorr"\]/);
    expect(guardSource).not.toMatch(/for forbidden in \[[^\]]*"schnorr"/);
  });

  it("9. structural: no new [dependencies] entry was added -- k256 remains the crate's only secp256k1 dependency line", () => {
    const depsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    const k256Lines = depsSection
      .split("\n")
      .filter((line: string) => line.trim().startsWith("k256"));
    expect(k256Lines.length).toBe(1);
    expect(depsSection).not.toMatch(/^secp256k1/m);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: package.json is untouched -- zero new npm dependency, this is a Rust-only Stage", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_181/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});

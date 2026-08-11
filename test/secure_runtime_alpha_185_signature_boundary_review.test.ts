import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_185_signature_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 185 -- "Nostr Signature Boundary Review": Stage
 * 5 of the Nostr Schnorr Signing Foundation Arc (Alpha 181-190).
 * REVIEW ONLY -- zero code change. Confirms no secret key, master
 * seed, or root handle ever crosses derive_nostr_signature_internal's
 * own boundary; only FedosNostrSignatureHandle does.
 */
describe("Secure Runtime Alpha 185 -- Nostr Signature Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc traces the function's own in/out boundary precisely", () => {
    const section = (designDocSource.match(/## 2\. What crosses the boundary([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*In:\*\* a BORROWED reference/);
    expect(section).toMatch(/\*\*Out:\*\* `Option<FedosNostrSignatureHandle>` — nothing else\./);
  });

  it("4. the design doc confirms Master Seed / Root Handles are never named or reachable", () => {
    const section = (designDocSource.match(/## 3\. Master Seed \/ Root Handles([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const handle of [
      "FedosMasterSeedHandle",
      "FedosIdentityRootHandle",
      "FedosApplicationRootHandle",
      "FedosProtocolRootHandle",
    ]) {
      expect(section).toContain(handle);
    }
    expect(section).toMatch(/appears\s*\nanywhere in its signature or body/);
    expect(section).toMatch(/does not, and structurally cannot, walk back up/);
  });

  it("5. the design doc confirms the secret byte copy is zeroized unconditionally on every path", () => {
    const section = (designDocSource.match(/## 4\. The secret key itself([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/on the VERY NEXT LINE after that call, on every\s*\n\s*path/);
    expect(section).toContain("secret_bytes.zeroize();");
  });

  it("6. the design doc cross-references Alpha 184, 183, 182, and 176", () => {
    for (const ref of [
      "secure_runtime_alpha_184_signature_determinism_verification",
      "secure_runtime_alpha_183_derive_nostr_signature_internal",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: derive_nostr_signature_internal's own body names no Master Seed or Root Handle type", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch?.[0] ?? "";
    for (const handle of [
      "FedosMasterSeedHandle",
      "FedosIdentityRootHandle",
      "FedosApplicationRootHandle",
      "FedosProtocolRootHandle",
    ]) {
      expect(body).not.toContain(handle);
    }
    expect(body).toContain("FedosNostrSecretKeyHandle");
    expect(body).toContain("FedosNostrSignatureHandle");
  });

  it("8. structural: exactly one zeroize() call in the function body, unconditional (not inside either match arm)", () => {
    const fnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    const body = fnMatch?.[0] ?? "";
    const zeroizeCalls = [...body.matchAll(/\.zeroize\(\)/g)];
    expect(zeroizeCalls.length).toBe(1);
    // The zeroize call sits after the match block closes (top-level statement).
    expect(body).toMatch(/\};\r?\n\s*secret_bytes\.zeroize\(\);/);
  });

  it("9. structural: FedosNostrSignatureHandle's impl block references no secret-adjacent type", () => {
    const implMatch = libRsSource.match(/impl FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    expect(implMatch).not.toBeNull();
    const body = implMatch?.[1] ?? "";
    for (const forbidden of ["FedosNostrSecretKeyHandle", "SchnorrSigningKey", "SecretHandle"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("10. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs and Cargo.toml carry no reference to this Stage's own doc -- confirming zero change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_185/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_185/);
  });

  it("12. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_185/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});

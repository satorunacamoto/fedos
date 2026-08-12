import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_427_minimal_rust_signing_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 427 -- "Minimal Rust Signing Boundary
 * Implementation": Stage 1 of Phase B (Alpha 427-430). Implementation
 * was attempted and STOPPED per this Stage's own binding instruction
 * ("if no safe seed authority exists, stop and report rather than
 * improvising one"). CONCLUDES Phase B is blocked -- see the design
 * doc's own §3.
 */
describe("Secure Runtime Alpha 427 -- Minimal Rust Signing Boundary Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc's critical finding quotes the Stage's own binding instruction", () => {
    expect(designDocSource).toMatch(
      /If no safe seed authority exists, stop and\s*\n> report rather than improvising one\./,
    );
  });

  it("3. the design doc concludes Phase B is blocked at this Stage", () => {
    expect(designDocSource).toMatch(/\*\*Conclusion: Phase B is BLOCKED at this Stage\.\*\*/);
  });

  it("4. the design doc's decision explicitly declines both improvisation paths", () => {
    expect(designDocSource).toMatch(/No safe seed authority exists\./);
    expect(designDocSource).toMatch(/No `FedosNostrSigningAuthority`\s*\nstruct is added\./);
  });

  it("5. structural: no FedosNostrSigningAuthority struct exists in lib.rs", () => {
    expect(libRsSource).not.toMatch(/struct FedosNostrSigningAuthority/);
  });

  it("6. structural: Cargo.toml is completely unmodified by this Arc -- still exactly the pinned wasm-bindgen/k256 versions from Alpha 422's own baseline", () => {
    expect(cargoTomlSource).toMatch(/wasm-bindgen = "0\.2\.126"/);
    expect(cargoTomlSource).toMatch(/k256 = \{ version = "0\.13", default-features = false, features = \["arithmetic", "schnorr"\] \}/);
  });

  it("7. the design doc cross-references Alpha 422, Alpha 424, and Alpha 144", () => {
    for (const ref of [
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
      "secure_runtime_alpha_424_nostr_signing_authority_scope",
      "secure_runtime_alpha_144_recovery_threat_model_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. no signing authority source file exists as a result of this Stage", () => {
    expect(existsSync("src/desktop/fedos_nostr_signing_authority.ts")).toBe(false);
    expect(existsSync("src/desktop/fedos_wasm_nostr_signing_authority.ts")).toBe(false);
  });

  it("9. no Alpha 428 or Alpha 429 doc exists -- nothing was implemented to adapt or verify", () => {
    expect(existsSync("docs/secure_runtime_alpha_428_typescript_signing_authority_adapter.md")).toBe(false);
    expect(existsSync("docs/secure_runtime_alpha_429_nostr_signing_boundary_verification.md")).toBe(false);
  });
});

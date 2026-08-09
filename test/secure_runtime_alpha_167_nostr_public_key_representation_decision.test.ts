import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_167_nostr_public_key_representation_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 167 -- "Nostr Public Key Representation Decision":
 * Stage 2 of the Deterministic Nostr Public Key Derivation Arc. A
 * DESIGN/DECISION ONLY Stage -- zero code change. Compares Options A-D and
 * adopts Option C (a dedicated 32-byte x-only type).
 */
describe("Secure Runtime Alpha 167 -- Nostr Public Key Representation Decision", () => {
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

  it("3. the design doc compares all four named options A-D", () => {
    const section = (designDocSource.match(/## 2\. Options compared([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const label of [
      "`k256::PublicKey` held directly",
      "`k256::schnorr::VerifyingKey` held directly",
      "32-byte x-only material, dedicated type",
      "SEC1 compressed 33-byte public key held",
    ]) {
      expect(section).toContain(label);
    }
  });

  it("4. the design doc adopts Option C explicitly", () => {
    expect(designDocSource).toMatch(
      /\*\*Option C — a dedicated `FedosNostrPublicKeyHandle` type holding\s*\nexactly the 32-byte x-only public key material Nostr itself requires —\s*\nis adopted\.\*\*/,
    );
  });

  it("5. the design doc excludes Option B for needing a new Cargo feature", () => {
    expect(designDocSource).toMatch(
      /Option B is definitively excluded: it would need a new\s*\n`k256` Cargo feature/,
    );
  });

  it("6. the design doc's own Protocol Extensibility framing: Session/ATProto separation is the strongest for Option C", () => {
    const section = (designDocSource.match(/\| Session\/ATProto separation \|([\s\S]*?)\n\n/) ?? [])[0] ?? "";
    expect(section).toMatch(/STRONGEST separation of the four/);
  });

  it("7. the design doc cross-references Alpha 166, 162, and 143", () => {
    for (const ref of [
      "secure_runtime_alpha_166_existing_nostr_public_key_inventory",
      "secure_runtime_alpha_162_nostr_account_derivation_decision",
      "secure_runtime_alpha_143_domain_separation_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("8. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change from this Stage", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_167/);
  });

  it("9. RIPPLE (Secure Runtime Alpha 181): Option B (representing the PUBLIC KEY itself via k256::schnorr::VerifyingKey) was rejected, not silently implemented -- no k256::schnorr reference existed anywhere in lib.rs AS OF this Stage's own closing state; Stage 1029 (Secure Runtime Alpha 181) legitimately imports k256::schnorr in a LATER Arc, but for an ENTIRELY DIFFERENT purpose (real Schnorr SIGNING, Alpha 183) than this Stage's own rejected Option B (public key REPRESENTATION) -- derive_nostr_public_key_internal itself still never references k256::schnorr, and no FedosNostrVerifyingKeyHandle-shaped type exists, both reconfirmed here as the CURRENT state", () => {
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrVerifyingKeyHandle/);
    const publicKeyFnMatch = libRsSource.match(
      /pub\(crate\) fn derive_nostr_public_key_internal\([\s\S]*?\r?\n {4}\}\r?\n/,
    );
    expect(publicKeyFnMatch).not.toBeNull();
    expect(publicKeyFnMatch?.[0] ?? "").not.toMatch(/k256::schnorr/);
  });

  it("10. Regression: desktop_application.ts and worker.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_167/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_167/);
  });

  it("11. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_167/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_167/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

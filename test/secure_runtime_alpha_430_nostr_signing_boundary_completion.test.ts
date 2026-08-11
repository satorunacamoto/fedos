import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_430_nostr_signing_boundary_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosDesktopHostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrEventIdVerifierSource from "../src/os/messenger/desktop/nostr_event_id_verifier.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 430 -- "Nostr Signing Boundary Completion Gate
 * / Declaration": Stage 6 (final) of the Alpha 422-430 Arc. Declares
 * Phase A (Alpha 422-426) complete and Phase B (Alpha 427-430) honestly
 * blocked at Alpha 427.
 */
describe("Secure Runtime Alpha 430 -- Nostr Signing Boundary Completion Gate / Declaration", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc's gate declares Phase A passed and Phase B blocked", () => {
    expect(designDocSource).toMatch(/\*\*Gate: Phase A PASSED\. Phase B BLOCKED — honestly, not silently\.\*\*/);
  });

  it("3. the design doc does NOT recommend the Nostr Outbound Board Publisher Arc unconditionally", () => {
    expect(designDocSource).toMatch(
      /\*\*Not\*\* "Secure Runtime Alpha 431–440: Nostr Outbound Board Publisher\s*\nArc"/,
    );
  });

  it("4. the design doc recommends a Master Seed Authority Boundary Arc as the exact prerequisite", () => {
    expect(designDocSource).toMatch(/\*\*Recommended: Secure Runtime — Master Seed Authority Boundary Arc\*\*/);
  });

  it("5. the design doc explicitly states Alpha 428 and Alpha 429 do not exist", () => {
    expect(designDocSource).toMatch(/\*\*Alpha 428\s*\nand Alpha 429 do not exist as docs or tests\*\*/);
  });

  it("6. no Alpha 428 or Alpha 429 doc/test file exists", () => {
    expect(existsSync("docs/secure_runtime_alpha_428_typescript_signing_authority_adapter.md")).toBe(false);
    expect(existsSync("docs/secure_runtime_alpha_429_nostr_signing_boundary_verification.md")).toBe(false);
    expect(existsSync("test/secure_runtime_alpha_428_typescript_signing_authority_adapter.test.ts")).toBe(false);
    expect(existsSync("test/secure_runtime_alpha_429_nostr_signing_boundary_verification.test.ts")).toBe(false);
  });

  it("7. structural: Cargo.toml and package.json carry no reference to this Arc's own docs", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_42[2-9]|secure_runtime_alpha_430/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_42[2-9]|secure_runtime_alpha_430/);
  });

  it("8. structural: the completed Outbox host coordination method is untouched by this Arc", () => {
    expect(fedosDesktopHostSource).toMatch(/submitPostWithOutbox/);
    expect(fedosDesktopHostSource).not.toMatch(/secure_runtime_alpha_42[2-9]|secure_runtime_alpha_430/);
  });

  it("9. structural: the existing inbound Nostr event verifier is untouched by this Arc", () => {
    expect(nostrEventIdVerifierSource).toMatch(/export function verifyNostrEventId/);
    expect(nostrEventIdVerifierSource).not.toMatch(/secure_runtime_alpha_42[2-9]|secure_runtime_alpha_430/);
  });

  it("10. the design doc cross-references every doc this Arc produced, Alpha 422 through Alpha 427", () => {
    for (const ref of [
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
      "secure_runtime_alpha_423_nostr_signing_boundary_options",
      "secure_runtime_alpha_424_nostr_signing_authority_scope",
      "secure_runtime_alpha_425_nostr_signing_input_model",
      "secure_runtime_alpha_426_signed_nostr_event_output_model",
      "secure_runtime_alpha_427_minimal_rust_signing_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("11. the design doc confirms p2p/ was untouched, not silently omitted", () => {
    expect(designDocSource).toMatch(/\*\*`p2p\/` untouched\*\*: confirmed/);
  });
});

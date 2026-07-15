import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_402_canonical_host_write_authority_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

/**
 * Secure Runtime Alpha 402 -- "Canonical Host Write Authority
 * Decision": Stage 2 of the Alpha 401-410 Desktop Host Canonical
 * Write Boundary Closure Arc. Review only. Adopts Option C -- board()
 * is replaced by a read-only Board interface, no transitional legacy
 * accessor.
 */
describe("Secure Runtime Alpha 402 -- Canonical Host Write Authority Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3500);
  });

  it("2. the design doc adopts Option C explicitly, without a transitional readBoard()", () => {
    expect(designDocSource).toContain(
      "**Option C, adopted, exactly as this Arc's own preferred direction",
    );
    expect(designDocSource).toContain("with NO transitional\n`readBoard()` accessor");
  });

  it("3. the design doc rejects Option A per this Arc's own explicit instruction", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "Rejected, per this Arc's own instruction: documentation alone does not close a reachable runtime bypass.",
    );
  });

  it("4. the design doc rejects Option B, naming both runtime proxy complexity and false type safety", () => {
    expect(designDocSource).toContain("runtime proxy complexity");
    expect(designDocSource).toContain('"false type safety"');
  });

  it("5. the design doc rejects Option D as an unnecessary compatibility claim, citing Alpha 401's own finding", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "Option D is therefore NOT adopted.",
    );
  });

  it("6. the design doc rejects Option E, citing non-redundant read capability", () => {
    expect(designDocSource).toContain("Rejected — Alpha 401 §6 already confirmed");
  });

  it("7. structural: no readBoard() method is declared on the Host class -- 'readBoard' appears only in this file's own doc comment naming the rejected Option D", () => {
    expect(hostSource).not.toMatch(/^\s*readBoard\(/m);
  });

  it("8. the design doc cross-references Alpha 401, Alpha 392, and Alpha 385", () => {
    for (const ref of [
      "secure_runtime_alpha_401_host_write_surface_inventory",
      "secure_runtime_alpha_392_write_coordination_ownership_decision",
      "secure_runtime_alpha_385_board_service_access_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

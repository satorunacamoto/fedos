import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import gateDoc from "../docs/secure_runtime_alpha_440_master_seed_authority_phase_gate.md?raw";

describe("Secure Runtime Alpha 440 -- Master Seed Authority Phase Gate", () => {
  it("documents all sixteen gate conditions with a result", () => {
    for (let n = 1; n <= 16; n++) {
      expect(gateDoc).toMatch(new RegExp(`\\| ${n} \\|`));
    }
  });

  it("declares a PASS verdict", () => {
    expect(gateDoc).toContain("**PASS.**");
  });

  it("names the real cargo test result, not a claimed build failure", () => {
    expect(gateDoc.replace(/\s+/g, " ")).toMatch(/515 passed, 1 pre-existing failure/);
    expect(gateDoc).not.toMatch(/fails to BUILD/);
  });

  it("names the external CARGO_TARGET_DIR workaround for the Windows path problem", () => {
    expect(gateDoc).toContain("CARGO_TARGET_DIR");
  });
});

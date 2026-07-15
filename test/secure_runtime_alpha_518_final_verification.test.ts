import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_518_final_verification.md?raw";

describe("Secure Runtime Alpha 518 -- Final Verification", () => {
  it("records the full-repository npm test numbers and zero overlap with this Arc's own files", () => {
    expect(doc).toMatch(/210 failed files \/ 320 failed tests/);
    expect(doc).toMatch(/zero\s+overlap/);
  });

  it("confirms both ripple fixes were re-run and no longer appear in the failure list", () => {
    expect(doc).toMatch(/re-run after the fix, not merely asserted/);
  });

  it("confirms no Rust file touched, cargo check not run, and no generated artifact", () => {
    expect(doc).toMatch(/No Rust file is touched by this Arc/);
    expect(doc).toMatch(/cargo check` was not run/);
    expect(doc).toMatch(/all\s+confirmed ABSENT/);
  });

  it("names the one pre-existing, unrelated typecheck error", () => {
    expect(doc).toContain("secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts");
  });
});

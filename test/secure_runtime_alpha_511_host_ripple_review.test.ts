import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_511_host_ripple_review.md?raw";

describe("Secure Runtime Alpha 511 -- Host Ripple Review", () => {
  it("names the two genuine ripples fixed and the three confirmed-unrelated failures left alone", () => {
    expect(doc).toContain("secure_runtime_alpha_488_desktop_host_ownership_review.test.ts");
    expect(doc).toContain("secure_runtime_alpha_386_host_query_delegation_review.test.ts");
    expect(doc).toContain("secure_runtime_alpha_400_desktop_host_write_coordination_completion.test.ts");
    expect(doc).toContain("secure_runtime_alpha_402_canonical_host_write_authority_decision.test.ts");
    expect(doc).toContain("secure_runtime_alpha_410_host_write_boundary_completion.test.ts");
    expect(doc).toMatch(/Confirmed\s*\n?unrelated; NOT modified by this Arc\./);
  });

  it("names the new invariant added for the Alpha 386 ripple, per this Arc's own instruction not to merely widen the list", () => {
    expect(doc).toMatch(/genuinely NEW test, #2b, is\s*\n?\s*ADDED \(not a replacement\)/);
  });

  it("confirms the doc file behind the unrelated failure is untouched by this Arc", () => {
    expect(doc).toMatch(/is EMPTY for this Arc/);
  });

  it("confirms no directory-listing guard exists over src/desktop/host/", () => {
    expect(doc).toMatch(/No test anywhere in this repository asserts an exact directory listing/);
  });
});

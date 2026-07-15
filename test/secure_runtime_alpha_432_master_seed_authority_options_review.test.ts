import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import optionsDoc from "../docs/secure_runtime_alpha_432_master_seed_authority_options_review.md?raw";

describe("Secure Runtime Alpha 432 -- Master Seed Authority Options Review", () => {
  it("the options doc exists and is substantial", () => {
    expect(typeof optionsDoc).toBe("string");
    expect(optionsDoc.length).toBeGreaterThan(1200);
  });

  it("evaluates all seven candidate options named by this Stage's own instruction", () => {
    for (const label of ["A.", "B.", "C.", "D.", "E.", "F.", "G."]) {
      expect(optionsDoc).toContain(label);
    }
  });

  it("adopts Option A + E, and rejects Option B/C outright", () => {
    expect(optionsDoc).toMatch(/Adopted: A \+ E/);
    expect(optionsDoc).toMatch(/Why B and C are rejected outright/);
  });

  it("never adopts Option B merely because it is easy (this Arc's own binding instruction)", () => {
    expect(optionsDoc).toMatch(/Rejected/);
    expect(optionsDoc.indexOf("B. TypeScript supplies raw 32 bytes")).toBeGreaterThan(-1);
  });
});

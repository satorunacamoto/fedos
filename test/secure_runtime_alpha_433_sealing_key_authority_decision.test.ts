import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decisionDoc from "../docs/secure_runtime_alpha_433_sealing_key_authority_decision.md?raw";

describe("Secure Runtime Alpha 433 -- Sealing-Key Authority Decision", () => {
  it("the decision doc exists and is substantial", () => {
    expect(typeof decisionDoc).toBe("string");
    expect(decisionDoc.length).toBeGreaterThan(1000);
  });

  it("adopts Option B (user passphrase, Argon2id)", () => {
    expect(decisionDoc).toMatch(/Adopted: Option B/);
    expect(decisionDoc).toMatch(/Argon2id/);
  });

  it("explicitly rejects Option D (hardcoded key) and Option E (public device metadata)", () => {
    expect(decisionDoc).toMatch(/Rejected — absolute prohibition/);
    expect(decisionDoc.match(/Rejected — absolute prohibition/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("confirms Argon2id/AEAD are reused, not invented", () => {
    expect(decisionDoc).toMatch(/no new dependency/);
    expect(decisionDoc).toMatch(/seal_internal.*open_internal|open_internal.*seal_internal/s);
  });
});

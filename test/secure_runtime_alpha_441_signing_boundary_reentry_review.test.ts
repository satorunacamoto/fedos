import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_441_signing_boundary_reentry_review.md?raw";

describe("Secure Runtime Alpha 441 -- Signing Boundary Re-entry Review", () => {
  it("confirms the Alpha 427 blocker (no real Master Seed material) is genuinely removed", () => {
    expect(doc).toMatch(/The previous blocker is genuinely removed/);
  });

  it("confirms no previously frozen Alpha 422-426 decision is redesigned", () => {
    expect(doc).toMatch(/No previously frozen Alpha 422–426 decision is redesigned in this Arc/);
  });

  it("names the reused derivation chain by name", () => {
    for (const step of ["Identity Root", "Application Root", "Nostr Root", "derive_nostr_secret_key_internal"]) {
      expect(doc).toContain(step);
    }
  });
});

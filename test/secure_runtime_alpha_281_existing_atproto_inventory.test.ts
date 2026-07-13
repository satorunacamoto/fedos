import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_281_existing_atproto_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 281 -- "Existing AT Protocol / Bluesky
 * Inventory": Stage 1 of the AT Protocol Canonical Board Adapter Arc
 * (Alpha 281-290). Review only. Confirms no AT Protocol TypeScript code
 * exists in this repository before this Arc, and that the Rust-side
 * "ATProto" key-derivation root (Alpha 153) is a different layer,
 * unrelated to board-post modeling.
 */
describe("Secure Runtime Alpha 281 -- Existing AT Protocol / Bluesky Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all twelve required inventory questions from its own §3", () => {
    for (let i = 1; i <= 12; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: package.json carries no HTML/AT-Protocol/CID-related dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("4. the design doc confirms no TypeScript AT Protocol code exists, but reviews and excludes the Rust-side ATProto root domain", () => {
    expect(designDocSource).toMatch(/\*\*No TypeScript AT Protocol code exists\.\*\*/);
    expect(designDocSource).toMatch(/entirely at the Rust\/key-derivation layer/);
  });

  it("5. the design doc confirms no DID validation, AT URI parsing, or CID handling exists", () => {
    expect(designDocSource).toMatch(/### 3\.2 Whether DID validation exists\s*\n\s*\n\*\*No\.\*\*/);
    expect(designDocSource).toMatch(/### 3\.3 Whether AT URI parsing exists\s*\n\s*\n\*\*No\.\*\*/);
    expect(designDocSource).toMatch(/### 3\.4 Whether CID handling exists\s*\n\s*\n\*\*No\.\*\*/);
  });

  it("6. the design doc concludes new files belong under src/board/atproto/, never src/atproto/ or src/bluesky/", () => {
    expect(designDocSource).toContain("src/board/atproto/");
    expect(designDocSource).toMatch(/never under `src\/atproto\/` or `src\/bluesky\/`/);
  });

  it("7. the design doc cross-references Alpha 280, Alpha 277, Alpha 271, and Alpha 153", () => {
    for (const ref of [
      "secure_runtime_alpha_280_activitypub_board_adapter_completion",
      "secure_runtime_alpha_277_activitypub_board_adapter",
      "secure_runtime_alpha_271_existing_activitypub_inventory",
      "secure_runtime_alpha_153_session_atproto_wallet_root",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

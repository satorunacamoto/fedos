import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_271_existing_activitypub_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import htmlRenderSource from "../src/os/_legacy_prototype/render/html.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 271 -- "Existing ActivityPub / Mastodon
 * Inventory": Stage 1 of the ActivityPub Canonical Board Adapter Arc
 * (Alpha 271-280). Review only. Confirms no ActivityPub code exists in
 * this repository before this Arc, and that no inbound HTML sanitizer
 * exists (only an outbound escaper).
 */
describe("Secure Runtime Alpha 271 -- Existing ActivityPub / Mastodon Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all ten required inventory questions from its own §3", () => {
    for (let i = 1; i <= 10; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: src/render/html.ts's escapeHtml is an OUTPUT escaper, not an inbound sanitizer", () => {
    expect(htmlRenderSource).toMatch(/Escapes the five HTML-significant characters/);
    expect(htmlRenderSource).not.toMatch(/DOMPurify|sanitize|stripTags|htmlToText/i);
  });

  it("4. structural: package.json carries no HTML/ActivityPub-related dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("5. the design doc confirms no ActivityPub code, no HTTP signature verification, and no Actor resolution exist", () => {
    expect(designDocSource).toMatch(/\*\*None\.\*\* `src\/activitypub\/` does not exist/);
    expect(designDocSource).toMatch(/\*\*No\.\*\* No HTTP Signature verification code exists/);
    expect(designDocSource).toMatch(/\*\*No\.\*\* No Actor-fetching, WebFinger, or NodeInfo code exists/);
  });

  it("6. the design doc concludes new files belong under src/board/activitypub/, never src/activitypub/", () => {
    expect(designDocSource).toContain("src/board/activitypub/");
    expect(designDocSource).toMatch(/never under a new `src\/activitypub\/`/);
  });

  it("7. the design doc cross-references Alpha 270, Alpha 266, and Alpha 261", () => {
    for (const ref of [
      "secure_runtime_alpha_270_nostr_board_adapter_completion",
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
      "secure_runtime_alpha_261_nostr_board_field_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

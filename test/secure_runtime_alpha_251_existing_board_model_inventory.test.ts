import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_251_existing_board_model_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import socialEventSource from "../src/social/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import socialBoardSource from "../src/social/board.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import communityModerationSource from "../src/community/moderation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSource from "../src/index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 251 -- "Existing Board Model Inventory": Stage 1
 * of the Canonical Board Model Foundation Arc (Alpha 251-260). Review
 * only. Confirms no canonical board model existed before this Arc, that
 * this repository's existing label-only descriptors carry no content
 * field (so none is reusable as-is), and that no branded-string pattern
 * existed before Alpha 252.
 */
describe("Secure Runtime Alpha 251 -- Existing Board Model Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc answers all sixteen numbered inventory questions from its own §3", () => {
    for (let i = 1; i <= 16; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("4. structural: src/social/event.ts and src/social/board.ts are confirmed label-only, no content field", () => {
    expect(socialEventSource).toMatch(/NO raw bytes field\. NO `content`\/`body`\/`text` field/);
    expect(socialBoardSource).toMatch(/NO event\/bytes\/content field/);
  });

  it("5. structural: src/community/moderation.ts already fixes hide/mute/filter-never-delete at the community-policy layer", () => {
    expect(communityModerationSource).toMatch(/NO delete\/remove\/purge action exists anywhere in this file/);
  });

  it("6. the design doc concludes that src/board/ is genuinely new and no existing type is reused directly", () => {
    expect(designDocSource).toMatch(/The Canonical Board Model\s+is genuinely new/);
    expect(designDocSource).toMatch(/no existing honest abstraction is duplicated/i);
  });

  it("7. the design doc decides NOT to extend src/index.ts's barrel, and confirms the barrel is not consistently maintained", () => {
    expect(designDocSource).toMatch(/NOT extended for `src\/board\/`/);
    expect(indexSource).not.toMatch(/src\/desktop\//);
    expect(indexSource).not.toMatch(/src\/identity\//);
    expect(indexSource).not.toMatch(/src\/runtime\//);
  });

  it("8. Regression: package.json dependency count remains unchanged at 2 -- no new Cargo/npm dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("9. the design doc cross-references Alpha 250, Alpha 242, and Alpha 028/040", () => {
    for (const ref of [
      "secure_runtime_alpha_250_inbound_validation_completion",
      "secure_runtime_alpha_242_validated_nostr_event_model",
      "secure_runtime_alpha_028_fedos_identity_descriptor",
      "secure_runtime_alpha_040_fedos_identity_record",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_537_readme_status_update.md?raw";

describe("Secure Runtime Alpha 537 -- README Status Update", () => {
  it("README leads with the Alpha 521-540 status banner", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toMatch(
      /Status: Secure Runtime Alpha 521–540 — Durable Delivery Retry\s*\n?\s*> Coordination Arc \(complete\)/,
    );
  });

  it("README preserves the prior Alpha 501-520 banner nested beneath it", () => {
    const readme = readFileSync("README.md", "utf8");
    const newBannerIndex = readme.indexOf("Secure Runtime Alpha 521–540");
    const priorStatusIndex = readme.indexOf("Prior status:");
    const oldBannerIndex = readme.indexOf("Secure Runtime Alpha 501–520");
    expect(newBannerIndex).toBeGreaterThanOrEqual(0);
    expect(priorStatusIndex).toBeGreaterThan(newBannerIndex);
    expect(oldBannerIndex).toBeGreaterThan(priorStatusIndex);
  });

  it("README status banner references the new files this Arc added", () => {
    const readme = readFileSync("README.md", "utf8");
    for (const file of [
      "fedos_delivery_attempt_subject_id.ts",
      "fedos_delivery_retry_reason_codec.ts",
      "fedos_delivery_retry_registry.ts",
      "fedos_delivery_retry_query.ts",
    ]) {
      expect(readme).toContain(file);
    }
  });

  it("the doc confirms no other README section was touched", () => {
    expect(doc).toMatch(/What did NOT change/);
    expect(doc).toMatch(/numbered Stage log's own most recent/);
  });
});

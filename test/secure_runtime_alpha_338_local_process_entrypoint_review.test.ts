import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_338_local_process_entrypoint_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonBefore from "../package.json?raw";

/**
 * Secure Runtime Alpha 338 -- "Local Process Entry-Point Review":
 * Stage 8 of the Alpha 331-340 Desktop Host Runtime Foundation Arc.
 * Review only. Adopts Option B -- a testable Host only, deferring a
 * real executable entry point -- over adding a real main.ts (Option
 * A), a package.json bin/CLI (Option C), or reusing src/index.ts
 * (Option D).
 */
describe("Secure Runtime Alpha 338 -- Local Process Entry-Point Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc adopts Option B explicitly", () => {
    expect(designDocSource).toMatch(/\*\*Option B, adopted\.\*\*/);
  });

  it("3. the design doc rejects Options A, C, and D, each with a stated reason", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    expect(normalized).toContain("**Option A — add a real `src/desktop/main.ts` that starts the");
    expect(normalized).toContain("Rejected outright by this Arc's own Absolute Prohibitions");
    expect(designDocSource).toMatch(/Rejected: Alpha 331 §3\.9/);
  });

  it("4. structural: package.json has no bin field -- this Stage's own Option B keeps it that way", () => {
    const pkg = JSON.parse(packageJsonBefore);
    expect(pkg.bin).toBeUndefined();
  });

  it("5. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonBefore);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("6. the design doc names all five unresolved requirements a future entry-point Stage must fix first", () => {
    for (const requirement of [
      "**Configuration sourcing**",
      "**Process lifetime**",
      "**Signal handling**",
      "**Failure reporting**",
      "**Packaging**",
    ]) {
      expect(designDocSource).toContain(requirement);
    }
  });

  it("7. the design doc cross-references Alpha 331 and Alpha 337", () => {
    for (const ref of [
      "secure_runtime_alpha_331_existing_desktop_host_inventory",
      "secure_runtime_alpha_337_desktop_host_shutdown_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

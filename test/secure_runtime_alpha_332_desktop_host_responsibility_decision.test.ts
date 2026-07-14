import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_332_desktop_host_responsibility_decision.md?raw";

/**
 * Secure Runtime Alpha 332 -- "Desktop Host Responsibility Decision":
 * Stage 2 of the Alpha 331-340 Desktop Host Runtime Foundation Arc.
 * Review only. Adopts Option A -- a class owning its own dependencies
 * and lifecycle -- over free functions, extending DesktopApplication,
 * reusing createRuntime(), or reusing Worker startup.
 */
describe("Secure Runtime Alpha 332 -- Desktop Host Responsibility Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc adopts Option A explicitly", () => {
    expect(designDocSource).toMatch(/\*\*Option A, adopted exactly as named:\*\*/);
  });

  it("3. the design doc rejects Options B, C, D, and E, each with a stated reason", () => {
    for (const optionLabel of [
      "**Option B — a set of free startup/shutdown functions.**",
      "**Option C — extend `DesktopApplication` into the full host.**",
      "**Option D — use `createRuntime()` as the Desktop Host.**",
      "**Option E — use Worker startup as the host.**",
    ]) {
      expect(designDocSource).toContain(optionLabel);
    }
    expect(designDocSource).toMatch(/Rejected:/);
    expect(designDocSource).toMatch(/Rejected outright/);
  });

  it("4. the design doc names every forbidden Host responsibility", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    for (const forbidden of [
      "Master Seed bytes",
      "Protocol Secret Keys",
      "Relay Pool",
      "GUI state",
      "Worker state",
      "Ontology state",
      "global process singleton state",
    ]) {
      expect(normalized).toContain(forbidden);
    }
  });

  it("5. the design doc names the exact implementation locations Alpha 333-337 must use", () => {
    expect(designDocSource).toContain("src/desktop/host/fedos_desktop_host.ts");
    expect(designDocSource).toContain("src/desktop/host/fedos_desktop_host_state.ts");
    expect(designDocSource).toContain("src/desktop/host/create_fedos_desktop_host.ts");
  });

  it("6. the design doc cross-references Alpha 331, Alpha 096, and Alpha 062", () => {
    for (const ref of [
      "secure_runtime_alpha_331_existing_desktop_host_inventory",
      "secure_runtime_alpha_096_desktop_shell_skeleton",
      "secure_runtime_alpha_062_identity_bootstrap_reset_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

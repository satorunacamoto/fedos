import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_326_append_only_backend_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dpapiHelperSource from "../src/runtime/fedos_windows_dpapi_helper.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 326 -- "Candidate D: Append-Only File Backend
 * Review": Stage 6 of the Alpha 321-330 Board Durable Backend Selection
 * & Architecture Arc. Review only -- implements no filesystem writes.
 * Confirms the append-only candidate needs zero new dependency, warns
 * explicitly against mistaking a naive JSON-overwrite for genuine
 * append-only durability, and confirms no real Desktop host process
 * exists to own it as authoritative state.
 */
describe("Secure Runtime Alpha 326 -- Candidate D: Append-Only File Backend Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc explicitly warns against a naive JSON-overwrite masquerading as append-only durability", () => {
    expect(designDocSource).toMatch(/## 3\. The one caution this Stage insists on/);
    expect(designDocSource).toMatch(/A naïve "read whole file/);
  });

  it("3. Regression: package.json dependency count remains unchanged at 2 -- confirming the zero-new-dependency claim", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("4. structural: the precedent this doc cites for reaching a Node API without @types/node (the DPAPI helper's own ts-expect-error) is real", () => {
    expect(dpapiHelperSource).toMatch(/@ts-expect-error `node:child_process` has no type declarations/);
  });

  it("5. the design doc's conclusion names the same missing prerequisite every other candidate shares: a real Desktop host process", () => {
    expect(designDocSource).toMatch(/its own test suite, which is close to the "imaginary environment" this/);
  });

  it("6. the design doc cross-references Alpha 321, Alpha 322, and the Windows DPAPI backend", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_322_durable_backend_requirements",
      "secure_runtime_alpha_023_windows_dpapi_storage_backend",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

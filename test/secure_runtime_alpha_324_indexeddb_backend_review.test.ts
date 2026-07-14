import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_324_indexeddb_backend_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vitestConfigSource from "../vitest.config.ts?raw";

/**
 * Secure Runtime Alpha 324 -- "Candidate B: IndexedDB Backend Review":
 * Stage 4 of the Alpha 321-330 Board Durable Backend Selection &
 * Architecture Arc. Review only -- implements no IndexedDB code.
 * Confirms IndexedDB has no real browser/webview host in this
 * repository, and explicitly clarifies the Cloudflare "Worker" naming
 * collision (Web Workers support IndexedDB; Cloudflare Workers do not).
 */
describe("Secure Runtime Alpha 324 -- Candidate B: IndexedDB Backend Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc explicitly clarifies the Cloudflare Worker vs. Web Worker naming collision", () => {
    expect(designDocSource).toMatch(/Available inside Web Workers/);
    expect(designDocSource).toMatch(/Cloudflare Workers' V8 isolate has NO IndexedDB/);
  });

  it("3. Regression: vitest runs under the node environment, confirming no native IndexedDB is available to this project's tests", () => {
    expect(vitestConfigSource).toMatch(/environment:\s*"node"/);
  });

  it("4. Regression: no IndexedDB polyfill dependency exists in package.json", () => {
    const pkg = JSON.parse(packageJsonSource);
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(allDeps)).not.toContain("fake-indexeddb");
    expect(Object.keys(allDeps)).not.toContain("idb");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("6. the design doc distinguishes the wire schemaVersion from IndexedDB's own DB-version integer", () => {
    expect(designDocSource).toMatch(/a different number from the wire record's own `schemaVersion` field/);
  });

  it("7. the design doc's conclusion defers on the same grounds as SQLite, plus the Worker-name distinction", () => {
    expect(designDocSource).toMatch(/Deferred on the same "no real host" grounds/);
  });

  it("8. the design doc cross-references Alpha 321, Alpha 322, and Alpha 323", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_322_durable_backend_requirements",
      "secure_runtime_alpha_323_sqlite_backend_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

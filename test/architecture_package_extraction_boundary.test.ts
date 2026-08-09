import { describe, it, expect } from "vitest";
// @ts-expect-error `.mjs` has no type declarations in this project's tsconfig -- mirrors architecture_cycle_detector.test.ts's own pattern for this sibling script.
import { runScan, ROOTS } from "../scripts/package_extraction_boundary_scan.mjs";

/**
 * Package Extraction Readiness (Compatibility Facade Reduction + Package
 * Extraction Readiness + Remaining Architecture Debt Closure arc, Agent P,
 * Half B) — the automated proof `docs/architecture/PACKAGE-EXTRACTION-PLAN.md`
 * points to. Runs `scripts/package_extraction_boundary_scan.mjs`'s real
 * import-graph scan (reusing `architecture_cycle_detector.mjs`'s own
 * resolution logic) and asserts on its output directly, rather than
 * re-implementing the scan in yet a third place.
 *
 * BASELINE, NOT ZERO: unlike the existing `architecture_boundary_*.test.ts`
 * suite (which enforces zero cross-domain imports for rules already fully
 * satisfied today), this file's own baseline is the CURRENTLY MEASURED
 * blocker count (48 at the time this test was written) — package
 * extraction is honestly NOT ready yet (see the plan doc's own READY/
 * PARTIAL/BLOCKED verdict). This test exists so a FUTURE regression (a new
 * `os/core`/`os/messenger`/`os/commerce` file importing outside its
 * declared roots) is caught immediately, and so a future FIX (reducing the
 * count) requires deliberately updating this test's own number — never a
 * silent widening.
 */

describe("package extraction boundary scan (scripts/package_extraction_boundary_scan.mjs)", () => {
  it("declares exactly the four roots this arc's plan covers", () => {
    expect(Object.keys(ROOTS).sort()).toEqual(
      ["apps/desktop-electron-spike", "os/commerce", "os/core", "os/messenger"].sort(),
    );
  });

  it("finds at least one file under every declared root (sanity -- catches an accidentally-empty root, e.g. a path-separator bug)", () => {
    const { closures } = runScan();
    for (const [rootKey, result] of Object.entries(closures) as [string, { fileCount: number }][]) {
      expect(result.fileCount, `expected ${rootKey} to have at least one file`).toBeGreaterThan(0);
    }
  });

  it("the Electron app root (os/core + os/messenger + os/commerce allowed) has ZERO blockers today -- the one root already ready", () => {
    const { blockers } = runScan();
    const appBlockers = blockers.filter((b: { root: string }) => b.root === "apps/desktop-electron-spike");
    expect(appBlockers).toEqual([]);
  });

  it("does not regress past the currently-measured blocker baseline (48) -- a new violation must update this number deliberately, never silently", () => {
    const { blockers } = runScan();
    expect(blockers.length).toBeLessThanOrEqual(48);
  });

  it("every blocker belongs to one of the three os/* roots (never the already-clean Electron app)", () => {
    const { blockers } = runScan();
    for (const b of blockers as { root: string }[]) {
      expect(["os/core", "os/messenger", "os/commerce"]).toContain(b.root);
    }
  });

  it("os/core's own blockers all resolve into exactly its two known external dependencies: packages/fedos-core-rust and src/runtime", () => {
    const { blockers } = runScan();
    const coreBlockers = blockers.filter((b: { root: string }) => b.root === "os/core");
    expect(coreBlockers.length).toBeGreaterThan(0);
    for (const b of coreBlockers as { resolvedTo: string }[]) {
      const startsWithKnownRoot = b.resolvedTo.startsWith("packages/fedos-core-rust/") || b.resolvedTo.startsWith("src/runtime/");
      expect(startsWithKnownRoot, `unexpected new os/core external dependency: ${b.resolvedTo}`).toBe(true);
    }
  });
});

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
 * blocker count — package extraction is honestly NOT fully ready yet (see
 * the plan doc's own READY/PARTIAL/BLOCKED verdict). This test exists so a
 * FUTURE regression (a new `os/core`/`os/messenger`/`os/commerce` file
 * importing outside its declared roots) is caught immediately, and so a
 * future FIX (reducing the count) requires deliberately updating this
 * test's own number — never a silent widening.
 *
 * UPDATED by the Runtime Ownership Extraction Arc: baseline was 48 (this
 * test's original number) / 46 (re-measured, authoritative, at this arc's
 * start — 2 of the original 48 had already been fixed by an earlier
 * commit). This arc closed Root Cause A (`src/runtime/`'s 19-file live
 * closure moved to `os/core`, 36 blockers) and Root Causes C (2 stray
 * old-path imports) and D's dead-`_legacy_prototype` edges (5 blockers),
 * leaving exactly **3**: Root Cause B (`os/core/crypto/fedos_core_adapter.ts`
 * → `packages/fedos-core-rust`, blocked on real npm workspaces not existing
 * yet) and Root Cause D's 2 SANCTIONED `os/commerce` → `os/messenger`
 * `NostrEvent` edges (an open design decision the plan doc explicitly
 * defers to a future extraction arc, not a mechanical gap). See
 * `docs/architecture/RUNTIME-OWNERSHIP-EXTRACTION-FINAL-VALIDATION.md`.
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

  it("does not regress past the currently-measured blocker baseline (10, up from 7 -- Commerce FINAL Closure Mega-Arc, Agent N -- a new violation must update this number deliberately, never silently)", () => {
    // Commerce E2E Completion arc, Wave B: 4 new, DELIBERATE, reviewed blockers on
    // top of the pre-existing 3 (os/core -> packages/fedos-core-rust; the two
    // pre-existing catalog/adapters/nostr/{bridge,classify}.ts -> os/messenger
    // imports) -- every one of the 4 new ones is the SAME kind of already-reviewed,
    // narrowly-scoped adapter-directory exception the pre-existing 2 already
    // established, not a new category of leak:
    //   - catalog/adapters/nostr/commerce_event_bridge.ts (Agent N) -> os/messenger's
    //     Nostr protocol layer, 3 import sites -- lives in the SAME
    //     NOSTR_ADAPTER_DIR (`test/architecture_boundary_commerce.test.ts`) the two
    //     pre-existing files already use; extends, does not widen, that allowlist.
    //   - receipt/commerce_trust_receipt_adapter.ts (Agent T) -> src/os/trust/index.js,
    //     1 import site -- the ONE reviewed Commerce->Trust seam Agent R's own Wave A
    //     design explicitly named as the future integration point (Gap #8,
    //     docs/commerce/COMMERCE-GAP-CLASSIFICATION.md); `test/architecture_boundary_commerce.test.ts`
    //     does not forbid this direction today (confirmed, re-verified independently
    //     by both Agent R and Agent T), and `test/architecture_boundary_trust.test.ts`
    //     only forbids the opposite direction.
    //
    // Commerce FINAL Closure Mega-Arc (Agent N): 3 more new, DELIBERATE,
    // reviewed blockers on top of the prior 7 -- the SUBSCRIBE/inbound
    // counterpart of the existing outbound bridge:
    //   - catalog/adapters/nostr/commerce_inbound_event_bridge.ts (Agent N) ->
    //     os/messenger's Nostr protocol layer, 3 import sites (`event.js`'s
    //     `isNostrEvent`, `noble_signature.js`'s `NobleSignatureVerifier`,
    //     `signature.js`'s `SignatureVerifier` type) -- lives in the SAME
    //     NOSTR_ADAPTER_DIR the outbound `commerce_event_bridge.ts` already
    //     uses; same narrowly-scoped exception, not a new category of leak.
    //     This file performs real signature verification on inbound Commerce
    //     Nostr events (`../../../events/commerce_nostr_event_read_model.ts`'s
    //     own input) -- it is the read-side of the SAME adapter boundary the
    //     write-side blockers above already crossed.
    const { blockers } = runScan();
    expect(blockers.length).toBeLessThanOrEqual(10);
  });

  it("every blocker belongs to one of the three os/* roots (never the already-clean Electron app)", () => {
    const { blockers } = runScan();
    for (const b of blockers as { root: string }[]) {
      expect(["os/core", "os/messenger", "os/commerce"]).toContain(b.root);
    }
  });

  it("src/runtime/ never reappears as a package-extraction blocker (Root Cause A regression guard -- the Runtime Ownership Extraction Arc's 19-file live closure must stay moved)", () => {
    const { blockers } = runScan();
    for (const b of blockers as { resolvedTo: string }[]) {
      expect(b.resolvedTo.startsWith("src/runtime/"), `src/runtime/ regressed as a blocker source: ${b.resolvedTo}`).toBe(false);
    }
  });

  it("os/core's own remaining blocker is exactly Root Cause B (packages/fedos-core-rust, pending real npm workspaces)", () => {
    const { blockers } = runScan();
    const coreBlockers = blockers.filter((b: { root: string }) => b.root === "os/core");
    expect(coreBlockers.length).toBeGreaterThan(0);
    for (const b of coreBlockers as { resolvedTo: string }[]) {
      expect(b.resolvedTo.startsWith("packages/fedos-core-rust/"), `unexpected new os/core external dependency: ${b.resolvedTo}`).toBe(true);
    }
  });

  it("os/messenger's virtual package now PASSES (Root Cause A closed this arc)", () => {
    const { closures } = runScan();
    expect(closures["os/messenger"].pass).toBe(true);
    expect(closures["os/messenger"].disallowedTouched).toEqual([]);
  });
});

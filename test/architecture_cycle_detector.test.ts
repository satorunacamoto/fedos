import { describe, it, expect } from "vitest";
// @ts-expect-error `.mjs` modules have no declaration file in this project's tsconfig.
import { analyzeArchitectureCycles } from "../scripts/architecture_cycle_detector.mjs";

declare const process: { cwd(): string };

interface CycleSccSummary {
  members: string[];
  size: number;
  isRuntimeCycle?: boolean;
}

/**
 * Architecture Dependency Closure arc — CI-usable regression guard for
 * `scripts/architecture_cycle_detector.mjs`, the arc's own real
 * (Tarjan-based, not grep-based) dependency-graph cycle detector.
 *
 * Walks every `.ts`/`.tsx` file under `src/` and every `packages/<name>/src/`,
 * resolves every relative import/export/dynamic-import/require specifier to
 * its real on-disk target, and computes strongly-connected components. It
 * distinguishes two graphs:
 *
 *   - the FULL graph (type-only + value/runtime edges combined) — what
 *     TypeScript's own module graph sees, so a cycle cannot be hidden from
 *     this tool by relabeling a real dependency as `import type` (that
 *     relabeling would itself be a behavior change TypeScript would reject
 *     wherever the import is actually used as a value);
 *   - the RUNTIME-ONLY graph (value edges only — `import type`/`export type`
 *     edges removed) — what actually executes at runtime, after TypeScript
 *     erases every type-only import at emit.
 *
 * FRESH MEASUREMENT (this arc, re-verified against
 * `docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md`'s prior "1 SCC / 4
 * module-group" claim — see this arc's own report for the full drift
 * analysis): at the RUNTIME level, this repository has ZERO circular
 * dependencies. The one genuine runtime-level file cycle found
 * (`packages/fedos-core-rust/src/index.ts` <-> `wasm_loader.ts`, a barrel
 * file re-exporting a loader that needed to construct a class the barrel
 * itself defined) was fixed this arc by extracting the class to its own
 * leaf file (`placeholder_core.ts`) — see that commit's own file headers.
 *
 * What remains (6 SCCs, all in the FULL graph only, none of them survive on
 * the RUNTIME-ONLY graph) are TYPE-ONLY compile-time cycles: pairs/groups of
 * files whose only mutual reference is an `import type` (fully erased at
 * emit, e.g. two mutually-recursive interfaces describing a tree-shaped
 * value like "an Archive Bundle may contain a Group Section which may
 * contain child Archive Bundles"). These are idiomatic, common in typed
 * languages, and carry zero runtime coupling — NOT the same severity class
 * as a real cycle, so this test tracks them with a raised, but still
 * explicit and CI-enforced, ceiling rather than forcing an artificial
 * type-file split that would only serve this metric.
 *
 * The 6 accepted full-graph-only (type-only) SCCs, each still routed partly
 * through a migration-era compatibility shim (the OLD `src/conversation/**`
 * etc. path, which just `export * from`s the NEW `src/os/messenger/**`
 * file) on at least one edge:
 *   1. `conversations/archive/{fedos_conversation_archive_bundle,
 *      fedos_conversation_archive_group_section}.ts` (+ 2 old-path shims) —
 *      a bundle may embed a group section; a group section lists child
 *      bundles. Mutually-recursive TYPE ONLY (both files say so in their own
 *      header: "This file defines a TYPE ONLY").
 *   2. `conversations/{deletion,deletion_request,runtime,search}/*.ts` (+ 4
 *      old-path shims) — the conversation runtime facade, its deletion/
 *      deletion-request coordinators, and the search index cross-reference
 *      each other's TYPES for parameter/return shapes; every edge that
 *      closes the loop is `import type`.
 *   3. `src/sync/fedos_sync_journal.ts` <-> `src/sync/persistence/
 *      fedos_sync_journal_persistence.ts` — the journal's own persisted
 *      record type and the journal class reference each other by type only.
 *   4. `src/os/messenger/desktop/presentation/{fedos_desktop_conversation_
 *      ui_presentation_boundary,device_management/fedos_device_management_
 *      controller}.ts` — the presentation boundary constructs the device
 *      management controller (a real, value-level edge) but the controller
 *      only references the boundary's TYPE back.
 *   5. `src/runtime/{fedos_rust_invocation_adapter,
 *      fedos_internal_rust_call}.ts` — one direction is a real function
 *      call, the other is a type-only back-reference.
 *   6. `src/runtime/fedos_crypto_{backend_resolver,backend_interface,
 *      loader_backend}.ts` — a 3-file group; the loop-closing edge is
 *      type-only.
 *
 * None of these 6 involves `src/os/_legacy_prototype/` — legacy is excluded
 * from this baseline count for a documented reason below, but even with it
 * INCLUDED the SCC count is unchanged (verified: legacy's real edges into
 * `os/commerce` and into Nostr are all one-directional at the file level —
 * no legacy file is reachable back from anything it depends on).
 */

const REPO_ROOT = process.cwd();

// Accepted baseline for the FULL (type+value) graph. Any INCREASE beyond
// this fails CI — a genuinely new SCC (whether type-only or real) must be
// investigated and either fixed or deliberately added to this file's own
// documentation (and the ceiling bumped) by whoever's change caused it.
const ACCEPTED_FULL_GRAPH_SCC_BASELINE = 6;

// The runtime-only graph is held to a hard 0 — this is the actual "no
// circular dependency" bar a shipped, executing program is judged against.
// A NEW real (value-level) cycle anywhere in this repo fails this test
// immediately, regardless of the full-graph baseline above.
const ACCEPTED_RUNTIME_SCC_BASELINE = 0;

describe("architecture cycle detector (Tarjan SCC, full repo)", () => {
  it("finds a non-trivial file set (sanity)", () => {
    const result = analyzeArchitectureCycles({ repoRoot: REPO_ROOT });
    expect(result.totalFiles).toBeGreaterThan(1000);
    expect(result.totalEdges).toBeGreaterThan(1000);
  });

  it("the RUNTIME-ONLY dependency graph has zero circular dependencies", () => {
    const result = analyzeArchitectureCycles({ repoRoot: REPO_ROOT });
    if (result.runtimeSccCount > ACCEPTED_RUNTIME_SCC_BASELINE) {
      const details = result.runtimeSccs
        .map((scc: CycleSccSummary) => `  SCC (${scc.size} files):\n    ${scc.members.join("\n    ")}`)
        .join("\n");
      throw new Error(
        `Found ${result.runtimeSccCount} REAL (runtime-level) circular ` +
          `dependency component(s) — this repo previously had zero. A new ` +
          `value-level import cycle was introduced:\n${details}`
      );
    }
    expect(result.runtimeSccCount).toBe(ACCEPTED_RUNTIME_SCC_BASELINE);
  });

  it("the full (type+value) dependency graph stays at or below the accepted type-only-cycle baseline", () => {
    const result = analyzeArchitectureCycles({ repoRoot: REPO_ROOT });
    if (result.sccCount > ACCEPTED_FULL_GRAPH_SCC_BASELINE) {
      const details = result.sccs
        .map(
          (scc: CycleSccSummary) =>
            `  SCC (${scc.size} files, isRuntimeCycle=${scc.isRuntimeCycle}):\n    ${scc.members.join("\n    ")}`
        )
        .join("\n");
      throw new Error(
        `Found ${result.sccCount} SCC(s) in the full dependency graph, ` +
          `above the accepted baseline of ${ACCEPTED_FULL_GRAPH_SCC_BASELINE}. ` +
          `See this file's own header for the documented, accepted set. ` +
          `Full detail:\n${details}`
      );
    }
    expect(result.sccCount).toBeLessThanOrEqual(ACCEPTED_FULL_GRAPH_SCC_BASELINE);
  });

  it("excluding src/os/_legacy_prototype does not change the SCC counts (documented, not load-bearing)", () => {
    // src/os/_legacy_prototype/ is dead, quarantined pre-pivot code with no
    // deploy path (its own README documents this) — a defensible exclusion
    // candidate for a "shippable code" cycle count. This repo's measured
    // reality makes the exclusion moot either way: legacy participates in
    // NO strongly-connected component today (verified: every edge in or out
    // of legacy is one-directional at the file level), so including or
    // excluding it produces the identical SCC count. This test pins that
    // fact so a future change that DOES entangle legacy into a real cycle
    // is caught, whichever way the count is measured.
    const withLegacy = analyzeArchitectureCycles({ repoRoot: REPO_ROOT, excludeLegacyPrototype: false });
    const withoutLegacy = analyzeArchitectureCycles({ repoRoot: REPO_ROOT, excludeLegacyPrototype: true });
    expect(withoutLegacy.sccCount).toBe(withLegacy.sccCount);
    expect(withoutLegacy.runtimeSccCount).toBe(withLegacy.runtimeSccCount);
  });

  it("no SCC contains any file under src/os/_legacy_prototype/ (documents the legacy<->commerce edge is NOT a cycle)", () => {
    // docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md documents 13
    // legacy->commerce and 3 commerce->legacy file-level imports as a
    // "bidirectional coupling" at the directory/capability grain. Fresh,
    // file-level measurement (this test) confirms none of those edges
    // actually close a cycle: every legacy<->commerce import chain this
    // tool traced terminates in a leaf file with no import back toward its
    // origin. This is a materially different, LOWER severity finding than
    // "bidirectional coupling" suggests, and this assertion pins it.
    const result = analyzeArchitectureCycles({ repoRoot: REPO_ROOT, excludeLegacyPrototype: false });
    const legacyMembers = result.sccs
      .flatMap((scc: CycleSccSummary) => scc.members)
      .filter((m: string) => m.includes("os/_legacy_prototype/"));
    expect(legacyMembers).toEqual([]);
  });

  it("the intra-messenger production crypto authority factory / production_activation runtime boundary pair is NOT a cycle (drift vs. the prior arc's break-plan doc)", () => {
    // docs/architecture/CIRCULAR-DEPENDENCY-BREAK-PLAN.md documents a
    // 2-file cycle between
    // `conversations/encryption/production/fedos_conversation_canonical_production_crypto_authority_factory.ts`
    // and
    // `desktop/production_activation/fedos_production_conversation_encryption_runtime_boundary.ts`.
    // Fresh, file-level, grep-corroborated measurement (this arc) found the
    // real current dependency is ONE-DIRECTIONAL only (the factory imports
    // the runtime boundary; the runtime boundary imports two DIFFERENT,
    // sibling `conversations/encryption/*.ts` files — not the factory, not
    // its `production/` directory at all) — no SCC contains either file.
    // Pinned here so a future change reintroducing the reverse edge is
    // caught as a new cycle by the tests above, and so this specific,
    // previously-documented claim doesn't silently rot back into "assumed
    // true" without a test noticing it no longer holds.
    const result = analyzeArchitectureCycles({ repoRoot: REPO_ROOT });
    const involved = result.sccs.flatMap((scc: CycleSccSummary) => scc.members).filter((m: string) =>
      m.includes("fedos_conversation_canonical_production_crypto_authority_factory.ts") ||
      m.includes("fedos_production_conversation_encryption_runtime_boundary.ts")
    );
    expect(involved).toEqual([]);
  });
});

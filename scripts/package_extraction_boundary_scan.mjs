#!/usr/bin/env node
/**
 * Package Extraction Readiness scan (Compatibility Facade Reduction +
 * Package Extraction Readiness + Remaining Architecture Debt Closure arc,
 * Agent P, Half B).
 *
 * Reuses `scripts/architecture_cycle_detector.mjs`'s own file-resolution
 * logic (`analyzeArchitectureCycles()`) rather than re-implementing import
 * resolution — the SAME NodeNext-style `.js`-specifier -> `.ts`-file
 * resolution the existing cycle detector and every `test/architecture_*`
 * boundary test already trust.
 *
 * Two things this script proves, both real, both automatable (no prose
 * substitute):
 *
 *   1. BLOCKER SCAN: for each of the three intended future packages
 *      (`os/core`, `os/messenger`, `os/commerce`) plus the one real
 *      consumer app (`packages/fedos-desktop-electron-spike/src`), walks
 *      every file under that root and reports every import that resolves
 *      to a file OUTSIDE that root and outside the root's declared
 *      allowed dependency set (`os/core` for messenger/commerce; nothing
 *      for `os/core` itself; all three `os/*` roots for the Electron
 *      app). Every such edge is a real package-extraction blocker: code
 *      that would not resolve if the root were physically moved into its
 *      own package with only its declared dependencies installed.
 *
 *   2. VIRTUAL PACKAGE CLOSURE CHECK: computes the full transitive import
 *      closure (BFS over the SAME resolved graph) starting from each
 *      root's file set, and reports which OTHER top-level roots that
 *      closure ever touches. This is the "would `tsc` on a standalone
 *      tsconfig scoped to this root+its declared deps actually resolve
 *      every specifier" question, answered without physically creating
 *      that tsconfig or moving a single file.
 *
 * Usage:
 *   node scripts/package_extraction_boundary_scan.mjs [--json]
 */

import { relative, join, sep, resolve as pathResolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeArchitectureCycles } from "./architecture_cycle_detector.mjs";

const __filename = fileURLToPath(import.meta.url);

const REPO_ROOT = process.cwd();

/** The four roots this arc's package-extraction plan cares about, and each one's OWN declared allowed-dependency root set (by root key, not including itself). */
export const ROOTS = {
  "os/core": { dir: join(REPO_ROOT, "src", "os", "core"), allowed: [] },
  "os/messenger": { dir: join(REPO_ROOT, "src", "os", "messenger"), allowed: ["os/core"] },
  "os/commerce": { dir: join(REPO_ROOT, "src", "os", "commerce"), allowed: ["os/core"] },
  "apps/desktop-electron-spike": {
    dir: join(REPO_ROOT, "packages", "fedos-desktop-electron-spike", "src"),
    allowed: ["os/core", "os/messenger", "os/commerce"],
  },
};

function toRepoRelativePosix(absPath) {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

/** Which declared root (if any) a file belongs to, by longest-prefix match. */
function rootKeyForFile(file) {
  let best = null;
  let bestLen = -1;
  for (const [key, { dir }] of Object.entries(ROOTS)) {
    if ((file + sep).startsWith(dir + sep) || file === dir) {
      if (dir.length > bestLen) {
        best = key;
        bestLen = dir.length;
      }
    }
  }
  return best;
}

/**
 * Runs the full scan and returns `{ blockers, closures }` — the same
 * shape `main()` below prints. Exported so `test/architecture_package_extraction_boundary.test.ts`
 * can assert on it directly rather than parsing this script's own stdout.
 */
export function runScan() {
  const graph = analyzeArchitectureCycles({ repoRoot: REPO_ROOT });
  const { adjacency, edgeDetail } = graph;
  const allFiles = [...adjacency.keys()];

  const blockers = [];
  const closures = {};

  for (const [rootKey, { dir, allowed }] of Object.entries(ROOTS)) {
    const filesInRoot = allFiles.filter((f) => (f + sep).startsWith(dir + sep) || f === dir);

    // --- 1. Blocker scan: direct edges leaving the root to a disallowed place.
    for (const file of filesInRoot) {
      const targets = adjacency.get(file) ?? new Set();
      for (const target of targets) {
        const targetRootKey = rootKeyForFile(target);
        const targetIsInsideThisRoot = targetRootKey === rootKey;
        const targetIsInAllowedRoot = targetRootKey !== null && allowed.includes(targetRootKey);
        if (targetIsInsideThisRoot || targetIsInAllowedRoot) continue;

        // Outside this root and not an allowed sibling root (including
        // "not under src/os/** or packages/*/src at all", e.g. src/runtime,
        // src/notification, or a different packages/<name>/src tree).
        const key = file + "\u0000" + target;
        const detail = edgeDetail.get(key) ?? [];
        for (const edge of detail) {
          blockers.push({
            root: rootKey,
            file: toRepoRelativePosix(file),
            line: findLineNumber(file, edge.specifier),
            specifier: edge.specifier,
            resolvedTo: toRepoRelativePosix(target),
            resolvedRoot: targetRootKey ?? "(outside any declared root)",
            kind: edge.kind,
          });
        }
      }
    }

    // --- 2. Virtual package closure: full BFS reachability from this root's files.
    const visited = new Set(filesInRoot);
    const queue = [...filesInRoot];
    const touchedRoots = new Set([rootKey]);
    while (queue.length > 0) {
      const current = queue.pop();
      for (const target of adjacency.get(current) ?? []) {
        const targetRootKey = rootKeyForFile(target);
        if (targetRootKey !== null) touchedRoots.add(targetRootKey);
        else touchedRoots.add("(outside any declared root: " + outsideRootLabel(target) + ")");
        if (!visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
    const disallowedTouched = [...touchedRoots].filter((r) => r !== rootKey && !allowed.includes(r));
    closures[rootKey] = {
      fileCount: filesInRoot.length,
      closureSize: visited.size,
      touchedRoots: [...touchedRoots].sort(),
      disallowedTouched: disallowedTouched.sort(),
      pass: disallowedTouched.length === 0,
    };
  }

  return { blockers, closures };
}

/** Best-effort "what top-level src/<x>[/<y>] or packages/<x> directory is this" label for a file outside every declared root, for readability only. Two segments for src/os/<y> so src/os/_legacy_prototype doesn't collapse to the uninformative "src/os". */
function outsideRootLabel(file) {
  const rel = toRepoRelativePosix(file);
  const osMatch = /^src\/os\/([^/]+)/.exec(rel);
  if (osMatch) return "src/os/" + osMatch[1];
  const m = /^src\/([^/]+)/.exec(rel) || /^packages\/([^/]+)/.exec(rel);
  return m ? (rel.startsWith("packages/") ? "packages/" + m[1] : "src/" + m[1]) : rel;
}

/** Best-effort line number for a specifier inside a file, for report readability. Not load-bearing for correctness -- `null` just omits the ":N" suffix. */
function findLineNumber(file, specifier) {
  try {
    const content = readFileSync(file, "utf8");
    const idx = content.indexOf(specifier);
    if (idx === -1) return null;
    return content.slice(0, idx).split("\n").length;
  } catch {
    return null;
  }
}

function main() {
  const asJson = process.argv.includes("--json");
  const { blockers, closures } = runScan();

  if (asJson) {
    console.log(JSON.stringify({ blockerCount: blockers.length, blockers, closures }, null, 2));
    return;
  }

  console.log("Package Extraction Readiness -- blocker scan + virtual package closure check");
  console.log("");
  console.log(`PACKAGE EXTRACTION BLOCKERS: ${blockers.length}`);
  for (const b of blockers) {
    console.log(`  [${b.root}] ${b.file}${b.line ? ":" + b.line : ""} imports "${b.specifier}" (${b.kind}) -> ${b.resolvedTo} [${b.resolvedRoot}]`);
  }
  console.log("");
  console.log("Virtual package closure check (per root):");
  for (const [rootKey, result] of Object.entries(closures)) {
    console.log(`  ${rootKey}: ${result.pass ? "PASS" : "FAIL"} -- ${result.fileCount} own files, ${result.closureSize} total in closure`);
    console.log(`    touches roots: ${result.touchedRoots.join(", ")}`);
    if (!result.pass) {
      console.log(`    DISALLOWED roots touched: ${result.disallowedTouched.join(", ")}`);
    }
  }
}

const isDirectRun = process.argv[1] && pathResolve(process.argv[1]) === pathResolve(__filename);
if (isDirectRun) {
  main();
}

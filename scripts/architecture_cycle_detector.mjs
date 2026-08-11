#!/usr/bin/env node
/**
 * Architecture Dependency Closure arc — a real dependency-graph tool.
 *
 * Walks every `.ts`/`.tsx` file under `src/` and `packages/<name>/src/`,
 * resolves every *relative* import/export/dynamic-import/require
 * specifier to its real on-disk target file (mirroring TypeScript's own
 * NodeNext ESM resolution: specifiers are written with a `.js` extension
 * but resolve to the sibling `.ts` file), builds a directed graph, and
 * computes strongly-connected components with Tarjan's algorithm
 * (iterative, so it cannot stack-overflow on a repo this size).
 *
 * This is deliberately NOT grep-based module-group counting — it is a
 * real file-level graph with a real SCC algorithm, so its output is
 * exact, not an approximation. It resolves dynamic `import("...")` and
 * `require("...")` calls with a literal string argument too, specifically
 * so a cycle cannot be "fixed" by hiding it behind a dynamic import —
 * the whole point of Part 1 of this arc.
 *
 * It ALSO classifies every edge as type-only (fully erased at emit —
 * `import type`/`export type`, or a brace clause where every named import
 * carries an inline `type` modifier) or value/runtime, and computes SCCs
 * on BOTH the full graph and a value-only ("runtime") subgraph. A cycle
 * that exists only in the full graph but not the runtime graph is a pure
 * compile-time type cycle (e.g. two mutually-recursive interfaces) with
 * zero actual runtime coupling — a materially different, lower-severity
 * finding than a cycle that survives in the runtime graph too. A
 * type-only-import trick that merely RELABELS an existing value edge as
 * `type` to dodge this tool would still be caught, because such a
 * relabeling would change program behavior (the value would no longer be
 * usable at runtime) — this tool only trusts the `type` keyword where
 * TypeScript itself would also erase the import.
 *
 * Usage (CLI):
 *   node scripts/architecture_cycle_detector.mjs [--json] [--exclude-legacy]
 *
 * Usage (module):
 *   import { analyzeArchitectureCycles } from "./architecture_cycle_detector.mjs";
 *   const result = analyzeArchitectureCycles({ repoRoot });
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------------------
// 1. File discovery
// ---------------------------------------------------------------------------

/** Recursively lists every `.ts`/`.tsx` file under `dir`, skipping `node_modules`. */
function listSourceFilesRecursive(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      listSourceFilesRecursive(full, out);
    } else if (stats.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Discovers the file set this arc's scope requires: every `.ts` under
 * `src/`, plus every `.ts` under any `packages/<name>/src/` directory
 * (this naturally includes `packages/fedos-desktop-electron-spike/src`
 * and `packages/meshkv/src`, and naturally excludes
 * `packages/fedos-core-rust`, which has no `.ts` files under its `src/`).
 */
function discoverSourceFiles(repoRoot) {
  const files = [];
  const srcRoot = join(repoRoot, "src");
  if (existsSync(srcRoot)) listSourceFilesRecursive(srcRoot, files);

  const packagesRoot = join(repoRoot, "packages");
  if (existsSync(packagesRoot)) {
    for (const pkgName of readdirSync(packagesRoot)) {
      const pkgSrc = join(packagesRoot, pkgName, "src");
      if (existsSync(pkgSrc) && statSync(pkgSrc).isDirectory()) {
        listSourceFilesRecursive(pkgSrc, files);
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 2. Import/export/dynamic-import specifier extraction
// ---------------------------------------------------------------------------

// import ... from "spec";  export ... from "spec";  (captures the clause
// between the keyword and `from` so callers can tell type-only from value)
const FROM_CLAUSE_PATTERN = /\b(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;
// bare side-effect import: import "spec"; (always a value/runtime edge)
const SIDE_EFFECT_IMPORT_PATTERN = /\bimport\s+["']([^"']+)["']/g;
// dynamic import("spec") — always a value/runtime edge, resolved on purpose
// so a cycle cannot be hidden behind a dynamic import (see file header).
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
// require("spec") — same reasoning, covers a require()-based hiding trick.
const REQUIRE_PATTERN = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Given the clause between `import`/`export` and `from` (e.g. `type { A }`,
 * `{ type A, B }`, `* as ns`, `Default`), decides whether the WHOLE clause
 * is type-only (fully erased at emit, zero runtime edge) or carries at
 * least one value (a real runtime edge). Mixed clauses (`{ type A, B }`)
 * are classified as a value edge — the safe, conservative direction
 * (never hides a real runtime edge as type-only).
 */
function isTypeOnlyClause(clause) {
  const trimmed = clause.trim();
  if (/^type\b/.test(trimmed)) return true; // `import type {...}` / `export type {...}`
  const braceMatch = /^\{([^}]*)\}$/.exec(trimmed);
  if (braceMatch) {
    const items = braceMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return true; // `import {} from "x"` — no bindings, inert
    return items.every((item) => /^type\s+/.test(item));
  }
  // Default import, namespace import (`* as ns`), or anything else shaped
  // like a real binding — always a value-level (runtime) edge.
  return false;
}

/**
 * Extracts every specifier this file references, tagged with whether the
 * edge is type-only (erased at emit — no runtime dependency at all) or a
 * value/runtime edge. A specifier reached by BOTH a type-only statement
 * and a value statement in the same file is recorded as a value edge (a
 * real edge exists regardless of the type-only one).
 *
 * Comments and strings inside template literals are NOT specially
 * excluded (a plain regex pass, same discipline the existing
 * `test/architecture_boundary_*.test.ts` suite uses) — this can only ever
 * over-count (e.g. a specifier-shaped string inside a comment), never
 * under-count a real edge, which is the safe direction for a cycle
 * detector to err in.
 *
 * @returns {Map<string, "type"|"value">}
 */
function extractSpecifiers(content) {
  const specifiers = new Map();
  const setEdgeKind = (spec, kind) => {
    if (kind === "value" || !specifiers.has(spec)) specifiers.set(spec, kind);
  };

  FROM_CLAUSE_PATTERN.lastIndex = 0;
  let match;
  while ((match = FROM_CLAUSE_PATTERN.exec(content)) !== null) {
    const keyword = match[1];
    const clause = match[2];
    const specifier = match[3];
    if (keyword === "export" && /^\*/.test(clause.trim())) {
      // `export * from "spec"` — may re-export values; treat as a value edge.
      setEdgeKind(specifier, "value");
      continue;
    }
    setEdgeKind(specifier, isTypeOnlyClause(clause) ? "type" : "value");
  }

  for (const pattern of [SIDE_EFFECT_IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN, REQUIRE_PATTERN]) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      setEdgeKind(match[1], "value");
    }
  }

  return specifiers;
}

// ---------------------------------------------------------------------------
// 3. Specifier -> real file resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a relative specifier written from `fromFile` to a real file on
 * disk, mirroring this repo's NodeNext-style convention (`.js`-suffixed
 * specifiers resolving to sibling `.ts` files) plus the usual extension-
 * less/directory-index fallbacks. Returns `null` for non-relative
 * specifiers (bare package imports — cannot participate in an intra-repo
 * cycle) or for specifiers that don't resolve to any file this tool
 * tracks (e.g. `.json`, a real external path, or a genuinely missing
 * file — the latter would be a real bug but is out of this tool's scope).
 */
function resolveSpecifier(fromFile, specifier, fileSet) {
  if (!specifier.startsWith(".")) return null; // not a relative import

  const base = pathResolve(dirname(fromFile), specifier);
  const candidates = [];

  if (/\.tsx?$/.test(base)) {
    candidates.push(base);
  } else {
    const stripped = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
    candidates.push(`${stripped}.ts`, `${stripped}.tsx`);
    candidates.push(join(stripped, "index.ts"), join(stripped, "index.tsx"));
    candidates.push(`${base}.ts`, `${base}.tsx`);
    candidates.push(join(base, "index.ts"), join(base, "index.tsx"));
  }

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. Graph construction
// ---------------------------------------------------------------------------

/**
 * @typedef {{ from: string, to: string, specifier: string, kind: "type"|"value" }} Edge
 */

function buildGraph(repoRoot) {
  const files = discoverSourceFiles(repoRoot);
  const fileSet = new Set(files);
  /** @type {Map<string, Set<string>>} adjacency (type+value combined): file -> targets */
  const adjacency = new Map();
  /** @type {Map<string, Set<string>>} adjacency restricted to value/runtime edges only */
  const runtimeAdjacency = new Map();
  /** @type {Edge[]} */
  const edges = [];
  /** @type {Map<string, Edge[]>} keyed by "from\u0000to" for edge detail lookup */
  const edgeDetail = new Map();

  for (const file of files) {
    adjacency.set(file, new Set());
    runtimeAdjacency.set(file, new Set());
  }

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const specifiers = extractSpecifiers(content);
    for (const [specifier, kind] of specifiers) {
      const target = resolveSpecifier(file, specifier, fileSet);
      if (target === null || target === file) continue; // ignore unresolved + self-refs
      adjacency.get(file).add(target);
      if (kind === "value") runtimeAdjacency.get(file).add(target);
      const edge = { from: file, to: target, specifier, kind };
      edges.push(edge);
      const key = file + "\u0000" + target;
      if (!edgeDetail.has(key)) edgeDetail.set(key, []);
      edgeDetail.get(key).push(edge);
    }
  }

  return { files, adjacency, runtimeAdjacency, edges, edgeDetail };
}

// ---------------------------------------------------------------------------
// 5. Tarjan's SCC algorithm (iterative)
// ---------------------------------------------------------------------------

/**
 * Iterative Tarjan's strongly-connected-components algorithm. Avoids
 * recursion (a recursive implementation risks a stack overflow on a
 * repo-sized graph with long import chains) by maintaining an explicit
 * work stack of `{ node, iterator index }` frames.
 *
 * @param {Map<string, Set<string>>} adjacency
 * @returns {string[][]} every SCC (including trivial, single-node ones)
 */
function tarjanSCC(adjacency) {
  let indexCounter = 0;
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  for (const start of adjacency.keys()) {
    if (index.has(start)) continue;

    // Explicit work stack: each frame tracks the node and how far through
    // its neighbor list we've iterated, so we can resume after "recursing".
    const work = [{ node: start, neighbors: [...adjacency.get(start)], i: 0 }];
    index.set(start, indexCounter);
    lowlink.set(start, indexCounter);
    indexCounter++;
    stack.push(start);
    onStack.add(start);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame.i < frame.neighbors.length) {
        const next = frame.neighbors[frame.i];
        frame.i++;
        if (!index.has(next)) {
          index.set(next, indexCounter);
          lowlink.set(next, indexCounter);
          indexCounter++;
          stack.push(next);
          onStack.add(next);
          work.push({ node: next, neighbors: [...(adjacency.get(next) ?? [])], i: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(frame.node, Math.min(lowlink.get(frame.node), index.get(next)));
        }
      } else {
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1];
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node), lowlink.get(frame.node)));
        }
        if (lowlink.get(frame.node) === index.get(frame.node)) {
          const component = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            component.push(w);
          } while (w !== frame.node);
          sccs.push(component);
        }
      }
    }
  }

  return sccs;
}

// ---------------------------------------------------------------------------
// 6. Edge classification (for reporting — Part 1, item 2 of the arc brief)
// ---------------------------------------------------------------------------

function classifyEdge(edge, repoRoot) {
  const fromRel = relative(repoRoot, edge.from).split("\\").join("/");
  const toRel = relative(repoRoot, edge.to).split("\\").join("/");
  const legacyDerived = fromRel.includes("os/_legacy_prototype/") || toRel.includes("os/_legacy_prototype/");
  const productionActivationDerived =
    fromRel.includes("production_activation/") || toRel.includes("production_activation/") ||
    fromRel.includes("/production/") || toRel.includes("/production/");
  return { fromRel, toRel, legacyDerived, productionActivationDerived, kind: edge.kind };
}

// ---------------------------------------------------------------------------
// 7. Public entrypoint
// ---------------------------------------------------------------------------

function buildSccDetails(sccsRaw, edges, repoRoot) {
  return sccsRaw
    .filter((component) => component.length > 1)
    .map((component) => {
      const memberSet = new Set(component);
      const internalEdges = edges
        .filter((e) => memberSet.has(e.from) && memberSet.has(e.to))
        .map((e) => ({ ...classifyEdge(e, repoRoot), specifier: e.specifier }));
      return {
        members: component.map((f) => relative(repoRoot, f).split("\\").join("/")),
        size: component.length,
        internalEdges,
      };
    });
}

/**
 * @param {{ repoRoot?: string, excludeLegacyPrototype?: boolean }} [options]
 */
export function analyzeArchitectureCycles(options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const excludeLegacyPrototype = options.excludeLegacyPrototype ?? false;

  let { files, adjacency, runtimeAdjacency, edges, edgeDetail } = buildGraph(repoRoot);

  if (excludeLegacyPrototype) {
    const legacyMarker = join(repoRoot, "src", "os", "_legacy_prototype");
    const keep = new Set(files.filter((f) => !f.startsWith(legacyMarker)));
    files = [...keep];
    const filterAdj = (adj) => {
      const out = new Map();
      for (const f of files) out.set(f, new Set([...adj.get(f)].filter((t) => keep.has(t))));
      return out;
    };
    adjacency = filterAdj(adjacency);
    runtimeAdjacency = filterAdj(runtimeAdjacency);
    edges = edges.filter((e) => keep.has(e.from) && keep.has(e.to));
  }

  const sccs = buildSccDetails(tarjanSCC(adjacency), edges, repoRoot);
  const runtimeSccs = buildSccDetails(tarjanSCC(runtimeAdjacency), edges, repoRoot);
  const runtimeMemberSets = runtimeSccs.map((s) => new Set(s.members));

  // Tag each full-graph SCC with whether it survives on the runtime-only
  // subgraph (i.e. is a genuine runtime cycle) or only exists because of
  // type-only edges (a compile-time-only cycle, zero runtime coupling).
  const sccsTagged = sccs.map((scc) => {
    const isRuntimeCycle = runtimeMemberSets.some((rset) => scc.members.every((m) => rset.has(m)) && rset.size > 1);
    return { ...scc, isRuntimeCycle };
  });

  return {
    totalFiles: files.length,
    totalEdges: edges.length,
    sccCount: sccsTagged.length,
    runtimeSccCount: runtimeSccs.length,
    sccs: sccsTagged,
    runtimeSccs,
    adjacency,
    runtimeAdjacency,
    edges,
    edgeDetail,
  };
}

// ---------------------------------------------------------------------------
// 8. CLI runner
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const excludeLegacyPrototype = args.includes("--exclude-legacy");
  const repoRoot = process.cwd();

  const result = analyzeArchitectureCycles({ repoRoot, excludeLegacyPrototype });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          totalFiles: result.totalFiles,
          totalEdges: result.totalEdges,
          sccCount: result.sccCount,
          runtimeSccCount: result.runtimeSccCount,
          sccs: result.sccs,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Architecture cycle detector -- ${excludeLegacyPrototype ? "EXCLUDING" : "INCLUDING"} os/_legacy_prototype`);
  console.log(`Files scanned: ${result.totalFiles}`);
  console.log(`Edges (relative import graph, type+value): ${result.totalEdges}`);
  console.log(`Non-trivial SCCs (>1 member, full graph): ${result.sccCount}`);
  console.log(`Non-trivial SCCs (>1 member, RUNTIME-ONLY graph): ${result.runtimeSccCount}`);
  console.log("");

  result.sccs.forEach((scc, i) => {
    console.log(`SCC #${i + 1} -- ${scc.size} member(s) -- isRuntimeCycle=${scc.isRuntimeCycle}:`);
    for (const m of scc.members) console.log(`  - ${m}`);
    console.log(`  internal edges (${scc.internalEdges.length}):`);
    for (const e of scc.internalEdges) {
      console.log(`    ${e.fromRel}`);
      console.log(`      --(${e.kind}: ${e.specifier})--> ${e.toRel}`);
      console.log(`      [legacyDerived=${e.legacyDerived} productionActivationDerived=${e.productionActivationDerived}]`);
    }
    console.log("");
  });
}

const isDirectRun = process.argv[1] && pathResolve(process.argv[1]) === pathResolve(__filename);
if (isDirectRun) {
  main();
}

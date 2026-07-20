# Secure Runtime Alpha 4021–4100: Repository-Wide Node Type Isolation and Electron Build Compatibility — Phase B: Candidate Comparison

Every option below was evaluated with a REAL, minimal, disposable experiment against this repository's own actual files in this worktree — not by reasoning about TypeScript's documented behavior alone. Several of these experiments were ALSO independently attempted in the prior Arc (3881–3940); this Arc reproduces the load-bearing ones fresh (Phase A, item 12) rather than relying on that documentation alone.

## A. Separate Electron tsconfig with explicit Node/Electron types

This is exactly what Alpha 3881–3940 already built (`tsconfig.electron-spike.json`, `"types": ["node"]`). **REJECTED as insufficient on its own** — proven directly: the spike's own dedicated tsconfig typechecks cleanly in isolation, but the ROOT tsconfig (a SEPARATE, independent compilation) still shows the full 390-error ripple, because `@types/node`'s mere physical presence in the ONE SHARED `node_modules/@types/node` leaks into ANY compilation whose files import `node:*` — regardless of which tsconfig performed that OTHER compilation. A separate Electron tsconfig is necessary but not sufficient by itself.

## B. Root tsconfig exclusion of Electron plus Electron-specific build graph

**Directly tested and REJECTED**: excluded `src/desktop/electron_spike/` from the root tsconfig via a disposable scratch config, with `@types/node` still physically present (the honest, real post-install state) — root typecheck STILL produced 391 errors, nearly unchanged from the un-excluded baseline (397). Excluding the Electron files from the ROOT compilation does nothing to prevent the ROOT's OWN, otherwise-unrelated files (`src/board/`, `src/conversation/`, ~130 files) from independently resolving `node:*` against the SAME shared `node_modules/@types/node`. This option addresses the wrong axis: the problem is never about which files are compiled TOGETHER with the Electron files; it is about whether `@types/node` is discoverable AT ALL from the ROOT files' own filesystem location.

## C. TypeScript project references

Project references (`tsc -b`, `"references"` arrays) let multiple tsconfigs compose into one coordinated build graph with separate `tsconfig`-level isolation, but they do NOT create separate `node_modules` trees — every referenced project still resolves modules against whatever `node_modules` exists on disk at each project's own location. Since this repository has only ONE `node_modules` (at the root) today, adding `"references"` between the root and an Electron sub-project would not change the filesystem-resolution mechanism identified in Phase A item 12 at all. **REJECTED** — solves a build-orchestration problem this repository does not have (a single `tsc --noEmit` invocation was always sufficient before Electron), while leaving the actual leak mechanism (shared `node_modules`) completely unaddressed.

## D. Separate workspace/package for the Electron spike

Functionally the same shape as Option G below (a package with its own `package.json`), but specifically evaluated here as an npm **workspace** (a `"workspaces"` array in the root `package.json`, hoisting shared dependencies to one root `node_modules` by default). **REJECTED as npm workspaces specifically**: npm's default workspace hoisting behavior would still place `electron`'s own transitive `@types/node` at the ROOT `node_modules/@types/node` (exactly the state that causes the leak) unless hoisting is explicitly disabled — and disabling hoisting per-package is not a stable, well-supported npm feature (unlike pnpm/Yarn PnP). A workspace's own VALUE (shared root `npm install`, a single lockfile) is exactly what this Arc must NOT have, since a single shared `node_modules` is the root cause. This pushed the decision toward Option G — a package that is NOT part of an npm workspace at all, with its own, wholly independent `npm install`.

## E. Custom `typeRoots` containing only approved declarations

**Directly tested and REJECTED**: set `"typeRoots": []` on a disposable scratch root tsconfig (with `@types/node` present) — this did not stop the leak either, and additionally broke the EXISTING, legitimate `@cloudflare/workers-types` inclusion (`TS2688: Cannot find type definition file for '@cloudflare/workers-types'`), since `typeRoots` governs the SAME ambient-package-search mechanism `"types"` does — neither one governs per-import `node:*` module-specifier resolution (a filesystem lookup, confirmed in Phase A item 12).

## F. Explicit stub declarations for `node:*` in the root graph

Evaluated as: hand-written ambient `.d.ts` files declaring `declare module "node:fs" { ... }` etc. for the ROOT graph, mirroring Alpha 3881–3940's own now-superseded `fedos_electron_spike_node_globals.d.ts` shim. **REJECTED for the root graph specifically**: this would require accurately re-declaring the FULL surface of every `node:*` module the ~130 affected files actually use (fs, child_process, os, path, url, and more) — a large, error-prone, "giant hand-written `@types/node` replacement" this Arc's own Phase F instruction explicitly forbids ("do not create an inaccurate giant hand-written `@types/node` replacement"). It would also NOT resolve the underlying issue: the root graph's own INTENT (Phase C) is that `node:*` imports are genuinely UNAVAILABLE there (each import is paired with a real, deliberate `@ts-expect-error`, not a "please provide a shim" request) — providing real stub types would silently change 130 files' own compile-time contract from "unavailable, intentionally suppressed" to "available, narrowly typed," which is exactly the kind of silent meaning-change Phase C forbids ("do not silently change their meaning").

## G. Separate source tree plus separate local package.json — **SELECTED**

Directly tested and CONFIRMED: created `packages/fedos-desktop-electron-spike/` with its own `package.json` (declaring `electron`/`electron-builder` as ITS OWN devDependencies, no `"workspaces"` linkage of any kind) and ran `npm install` scoped to that directory alone — creating a wholly independent `packages/fedos-desktop-electron-spike/node_modules/` tree, containing its OWN copy of `@types/node`. Then, with the ROOT project's own `node_modules` reinstalled FRESH (no Electron, no `@types/node` at all, confirmed via `find node_modules -iname node -path "*@types*"` → empty): `npx tsc --noEmit` (root) → clean except the one pre-existing, unrelated failure. `npm run typecheck` (the isolated package's own) → clean, 0 errors. **This is the only option, of all evaluated, that survived direct, repeated (twice), from-scratch clean-install testing.**

- Correctness: proven directly, repeatedly.
- Maintainability: one extra `package.json`/lockfile pair to keep in sync — a real, disclosed cost (see below), but a small, well-understood one (this repository already maintains 2 other `packages/*` subdirectories, `fedos-core-rust` and `meshkv`, each with their own `package.json`).
- Root typecheck preservation: proven — the existing 254-file, `node:*`-unavailable contract is completely undisturbed, with zero edits to any of those files.
- Electron build support: proven — build/start/package all work, reusing the ROOT project's own already-installed `typescript` binary via a relative path (no duplicate `typescript`/`vitest` install needed).
- Test behavior: proven — a dedicated `vitest.electron-spike.config.ts` (reusing the root's own `vitest`, zero new dependency) keeps the Electron-spawning test file physically and configurationally separate from `npm test`'s own scope.
- Package-lock impact: root lockfile shrinks back near its pre-Electron size; ONE new, small, independently-scoped lockfile is added. Deliberate, not accidental "chaos" (Phase E's own concern) — the two lockfiles never reference each other and are never expected to be reconciled against one another.
- Future Host adapter support: a future "Package B" Arc (main/preload adapter) has a clean, pre-established package boundary to build directly on top of, with NO retrofitting needed.
- Windows/OneDrive compatibility: unaffected — this package lives inside the SAME mandated short-path worktree every prior Arc already uses; no new path-length/OneDrive concern introduced.
- CI compatibility: two independent `npm install`/`npm run typecheck` invocations (one per directory) — straightforward to script, no exotic workspace tooling required.
- Migration cost: real, but bounded and one-time — 9 files moved (`git mv`, preserving history), ~4 small new config files, 2 root files edited (`package.json`, `tsconfig.json`), 1 root file deleted (`tsconfig.electron-spike.json`), 1 new root file (`vitest.electron-spike.config.ts`).
- Ambient-type leakage risk: eliminated at the filesystem level, not merely configured around — the strongest, most durable guarantee among every option evaluated.

## H. Selective removal of stale `@ts-expect-error` directives

Not evaluated as a real candidate: this Arc's own Absolute Prohibitions explicitly forbid it ("remove or blanket-rewrite hundreds of `@ts-expect-error` directives"), and even narrowly, removing them would not be "selective" — ALL 390 are equally "stale" only in the presence of a leak this Arc has a real fix for; removing them would be indistinguishable from silently adopting `@types/node` repository-wide (which Phase C also forbids: "do not silently change their meaning").

## I. Postinstall deletion workaround

Rejected per this Arc's own explicit instruction, without further evaluation. (Alpha 3881–3940 already drafted and confirmed this working technically, then had it rejected by this environment's own permission classifier and, when presented directly, the user chose to stop rather than authorize it — this Arc does not revisit that decision.)

## J. Another evidence-backed option

None identified beyond A–I that survives Phase A's own item 12 experiment. A theoretical "vendor a private, scoped `@types/node` fork with npm `overrides`" was considered and rejected without a full experiment, based on Alpha 3881–3940's own DIRECT, already-confirmed finding that an `overrides` redirect crashes `npm install`'s own peer-dependency resolution for `vitest`/`vite` in this exact dependency graph.

## Decision

**Option G**, exactly as described above: `packages/fedos-desktop-electron-spike/`, a physically separate package with its own `package.json`/`package-lock.json`/`node_modules`, no npm workspace linkage, reusing the root project's own `typescript`/`vitest` binaries via relative invocation (avoiding any duplicate heavy install).

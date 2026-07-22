# Secure Runtime Alpha 4021–4100: Repository-Wide Node Type Isolation and Electron Build Compatibility — Phase A: Type Resolution Inventory

Written from direct investigation in this worktree (`C:\wt\node-type-isolation`, branch `arc/node-type-isolation`, based on commit `2f5bf72` — "Add Secure Runtime Alpha 3881-3940: Electron Dependency and Development Build Spike Arc"), reproducing the blocker fresh rather than relying on that Arc's own completion documentation alone.

## 1–5. Every tsconfig file, its relationships, and compiler settings (as of the base commit, before this Arc's own changes)

- **`tsconfig.json`** (root): `target: ES2022`, `module: ES2022`, `moduleResolution: Bundler`, `lib: ["ES2022", "WebWorker"]`, `types: ["@cloudflare/workers-types"]`, `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `skipLibCheck: true`, `noEmit: true`, `forceConsistentCasingInFileNames: true`. `include: ["src", "test", "packages"]`. No `exclude`, no `references`.
- **`tsconfig.runtime.json`**: `extends: "./tsconfig.json"`, overrides `noEmit: false`, `outDir: "dist"`. `include: ["src/desktop/runtime/run_fedos_desktop_runtime.ts"]` (one file only).
- **`tsconfig.electron-spike.json`** (Alpha 3881–3940's own): `extends: "./tsconfig.json"`, overrides `noEmit: false`, `outDir: "dist-electron-spike"`, `rootDir: "src/desktop/electron_spike"`, `module: "CommonJS"`, `moduleResolution: "Node10"`, `lib: ["ES2022", "DOM"]`, `types: ["node"]`, `verbatimModuleSyntax: false`, `isolatedModules: false`. `include`: the 4 spike source files under `src/desktop/electron_spike/`.

No `references` (TypeScript project references) are used anywhere in this repository — each tsconfig is invoked independently via its own `-p` flag, never composed via `tsc -b`.

## 6. How test files are typechecked

Via the root `tsconfig.json` alone (`"include": [..., "test", ...]`) — there is no separate test-specific tsconfig. `npm run typecheck` (= `tsc --noEmit`, before this Arc) type-checks every file under `test/` as part of the SAME single compilation as `src/`/`packages/`.

## 7. How runtime build files are typechecked

`npm run build:runtime` = `tsc -p tsconfig.runtime.json`, a real-emit (`noEmit: false`) compilation scoped to exactly one file (`run_fedos_desktop_runtime.ts`), extending the root tsconfig for all other settings.

## 8. How Electron spike files are built (before this Arc)

`npm run build:electron-spike` = `tsc -p tsconfig.electron-spike.json && node .../copy_electron_spike_static_assets.mjs` — a real-emit compilation of the 4 spike source files to `dist-electron-spike/`, plus a plain Node script copying the static HTML page alongside the compiled output.

## 9. Where `node:*` imports exist

254 files under `src/`/`test/` import a `node:*`-prefixed module (confirmed: `grep -rl "node:" test/ src/ --include="*.ts" --include="*.cts" | wc -l` → 254). The large majority are test files using `node:fs`/`node:child_process`/`node:os`/`node:path` for real-filesystem/subprocess-based integration tests (an established, repository-wide pattern going back many Arcs). A handful of `src/` files (e.g. `src/runtime/fedos_wasm_loader.ts`, `src/conversation/archive_cli/fedos_conversation_archive_cli_file_system.ts`, `src/conversation/archive/fs/fedos_conversation_archive_file_authority.ts`) also use `node:*` imports directly in production code, under the SAME suppression convention.

## 10–11. Where `@ts-expect-error` suppressions exist, and why they become "unused" with `@types/node` installed

Every one of the 254 `node:*`-importing files pairs each import with a `// @ts-expect-error <node:X> has no type declarations without @types/node in this project's tsconfig` comment immediately above it — a real, load-bearing, established convention (confirmed present since long before this Arc, e.g. `test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`'s own header, itself dated Alpha 2841–2920). Before Electron was ever added (`@types/node` genuinely absent), `tsc` reports `TS2307: Cannot find module 'node:fs' or its corresponding type declarations` for each such import — the `@ts-expect-error` comment correctly suppresses that real error. The MOMENT `@types/node` is present anywhere resolvable (see item 12), `tsc` successfully resolves the module's own type declarations, the `TS2307` error disappears, and the now-unnecessary suppression comment itself becomes a NEW error: `TS2578: Unused '@ts-expect-error' directive`.

## 12. Whether TypeScript resolves `node:*` despite `types` restrictions — verified directly, exhaustively, in this worktree

**Yes, confirmed empirically, again, in a FRESH worktree** (not merely citing Alpha 3881–3940's own prior finding): after a clean `npm install` (Electron present, `@types/node` installed transitively), `npx tsc --noEmit` produces exactly 397 errors: 390 `TS2578` (the ripple), 6 specific to the Alpha 3881–3940 spike files' own incompatibility with the root tsconfig's `verbatimModuleSyntax`/missing DOM lib, and 1 pre-existing unrelated failure. Removing `node_modules/@types/node` (a temporary, fully-reverted diagnostic step, not a persistent workaround) and re-running shows only the 1 pre-existing failure plus the spike-file-specific 6 (unrelated to `@types/node`) — proving the causal link directly, again.

**A NEW, more precise finding this Arc adds**: the leak is NOT caused by which files are compiled together (an earlier hypothesis, tested and DISPROVEN directly): excluding `src/desktop/electron_spike/` from the root tsconfig's own compilation, while `@types/node` remains physically present in `node_modules/@types/node`, STILL produces 391 `TS2578` errors — nearly identical to the un-excluded baseline. The true, sole mechanism: TypeScript's module resolution for a bare `node:*` import specifier walks the **filesystem** (up the directory tree from the importing file's own location, checking each ancestor's `node_modules/@types/*`) — completely independent of `tsconfig.json`'s own `"types"` allowlist, `"typeRoots"`, `"paths"`, or `"moduleResolution"` setting (every one of these was tried, in isolation, via disposable scratch-tsconfig experiments against this repository's own real files, both in this Arc and in Alpha 3881–3940; none prevented the leak). Since every file in this repository — `src/board/`, `src/conversation/`, and (before this Arc) `src/desktop/electron_spike/` — shares the ONE, single, root-level `node_modules/` tree, there is NO tsconfig-only configuration that can make `@types/node` invisible to some files but visible to others within that same shared filesystem tree.

## 13. Vitest/Vite type behavior

`vitest run` (both `npm test` and this Arc's own `test:electron-spike`) uses Vite's own esbuild-based transform pipeline, which strips TypeScript types without full type-checking. Confirmed directly: even with `npm run typecheck` failing (397 errors), every existing test suite continues to PASS under `vitest run` — type-checking and test execution are two entirely separate, independently-invoked processes in this repository, exactly as every prior Arc's own verification has already established.

## 14. Electron compiler requirements

Electron 43.1.1 requires Node `>= 22.12.0` (satisfied: this environment runs Node `v24.15.0`). Electron's own `package.json` declares `"@types/node": "^24.9.0"` as a REAL, direct dependency of the `electron` npm package itself — this is the origin of the leak; it is not introduced by any explicit choice this repository's own `package.json` makes. `electron-builder` (26.15.3) similarly requires Node.js and pulls in its own large dependency tree (`chalk`, `yargs`, `ci-info`, `fs-extra`, `lazy-val`, `dmg-builder`, `builder-util`, `app-builder-lib`, `builder-util-runtime`, `simple-update-notifier`), several of which (`fs-extra`) themselves declare `"@types/node": "*"` as a further transitive path to the same package.

## 15. Package scripts invoking `tsc` (before this Arc)

`typecheck` (`tsc --noEmit`), `build:runtime` (`tsc -p tsconfig.runtime.json`), `build:electron-spike` (`tsc -p tsconfig.electron-spike.json && ...`).

## 16. Exact expected files to change

- `package.json` (root) — remove `electron`/`electron-builder` devDependencies; add `typecheck:core`/`typecheck:electron`/rewired `typecheck`; rewire `build:electron-spike`/`start:electron-spike`/`package:electron-spike`/`test:electron-spike` to delegate into the new package.
- `package-lock.json` (root) — regenerated by `npm install` only, shrinks back toward its pre-Electron size.
- `tsconfig.json` (root) — ONE additive line: `"exclude": ["packages/fedos-desktop-electron-spike"]`.
- `tsconfig.electron-spike.json` (root) — DELETED (superseded by the new package's own `tsconfig.json`/`tsconfig.test.json`).
- NEW `vitest.electron-spike.config.ts` (root) — a separate, narrowly-scoped vitest config.
- `.gitignore` (root) — swap the two stale, root-anchored Alpha 3881–3940 output-directory entries for one new, package-scoped entry.
- NEW `packages/fedos-desktop-electron-spike/` — an entire new, physically isolated package: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `electron_builder.config.json`, `src/` (4 files, moved), `scripts/` (2 files, moved+adjusted), `test/` (1 file, moved+rewritten, +1 new small `?raw`-module ambient declaration).
- `src/desktop/electron_spike/` — DELETED entirely (moved).
- `test/secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` — DELETED (moved).

No file under `src/desktop/` outside the now-removed `electron_spike/` (i.e. `host_boundary/`, `shell/`, `presentation/`, `renderer/`, `runtime/` all untouched), `src/sync/`, `src/conversation/`, `src/nostr/`, `src/runtime/`, `packages/fedos-core-rust/`, `packages/meshkv/`, any Rust file, `p2p/`, or `.tmp_gen/` is touched.

## 17. Package-lock state

Before this Arc (base `2f5bf72`, Electron present at root): root `package-lock.json` reflects the large, ~4,700-package-line footprint Alpha 3881–3940 documented. After this Arc: root `package-lock.json` shrinks back to (within a few lines of) its ORIGINAL, pre-Electron size — confirmed directly via `git diff 2f5bf72 --stat -- package-lock.json`: net **3,763 deletions**, essentially removing everything Alpha 3881–3940 added. A NEW, separate `packages/fedos-desktop-electron-spike/package-lock.json` is created instead, scoped entirely to that package's own two devDependencies and their transitive tree — tracked normally (package-manager-generated, never hand-edited), exactly mirroring how the root's own `package-lock.json` is already tracked.

## 18. Baseline failures (reproduced fresh in this worktree, before any of this Arc's own changes)

- `npm install` (base commit, Electron present): 328 packages, `@types/node@24.13.3` present at `node_modules/@types/node`.
- `npm run typecheck` (`tsc --noEmit`): 397 errors — 390 `TS2578` (the ripple, across ~130 files), 6 specific to the Alpha 3881–3940 spike files' own root-tsconfig incompatibility, 1 pre-existing unrelated failure (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`, the same one every recent Arc's own baseline documents).
- Electron spike's own dedicated tsconfig (`tsconfig.electron-spike.json`): clean, 0 errors — confirming the spike's OWN files were never the problem in isolation; the problem was always the SHARED compilation with the rest of the repository.
- Existing Desktop Host/Shell/Presentation/Renderer regression: 77/77 passed (test EXECUTION unaffected by the typecheck-only ripple, confirmed directly).

## 19. Candidate solutions

See Phase B (separate document/section) for the full, evidence-backed comparison. Summary: every tsconfig-only option (A/B/C/E/F) is directly disproven by item 12's own experiment above — the filesystem-resolution mechanism cannot be blocked by any tsconfig setting when both sides of the "boundary" share one `node_modules` tree. Only a physically separate package (Option G/D — a genuinely separate `node_modules` tree) empirically isolates the leak, confirmed by direct experiment (Phase B/I).

## 20. Rollback plan

This worktree's own branch (`arc/node-type-isolation`) has zero commits beyond its base at the time this document was written. Rollback before this Arc's own commit: `git checkout 2f5bf72 -- .` or delete the worktree/branch. After this Arc's own commit exists: `git revert <this-arc's-commit-sha>` from base `2f5bf72`, or reset the branch tip back to `2f5bf72` if unpublished elsewhere. The new nested package's own `node_modules`/`dist`/`dist-package` are gitignored and never need reverting (they simply cease to exist once the branch reverts).

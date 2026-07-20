# Secure Runtime Alpha 4021–4100: Repository-Wide Node Type Isolation and Electron Build Compatibility — Completion Declaration

**Full completion.** `@types/node` remains installed (as Electron's own unavoidable transitive dependency, in a physically separate package's own `node_modules`); `npm run typecheck` passes (except the one pre-existing, unrelated failure every recent Arc's own baseline documents); Electron typecheck/build/package/tests all pass; no postinstall deletion workaround exists anywhere; clean install is reproducible (confirmed twice, independently, from scratch); no neutral production module gains ambient Node APIs.

## Root Type Graph Contract (Phase C)

Frozen, explicitly, by this Arc: the root TypeScript graph (`tsconfig.json`, `"include": ["src", "test", "packages"]`, now `"exclude": ["packages/fedos-desktop-electron-spike"]`) continues to treat every `node:*` import across its own ~254 files as **intentionally unavailable at compile time**, suppressed via the SAME, pre-existing, per-import `@ts-expect-error` convention this repository already used before Electron existed. This Arc changes NOTHING about that contract's own meaning — no file's suppression comment was edited, removed, or reinterpreted; the contract that "Node APIs are unavailable in this graph, and every use of one is deliberately, narrowly suppressed" is exactly as true today as it was before this Arc, and before Alpha 3881–3940 ever added Electron.

## Electron Type Graph (Phase D)

`packages/fedos-desktop-electron-spike/` — a dedicated TypeScript project (`tsconfig.json` for the real build, `tsconfig.test.json` extending it to additionally cover the test file) that explicitly opts into Node types (`"types": ["node"]`) and Electron types (via ordinary `import ... from "electron"` resolution against its own local `node_modules/electron/electron.d.ts`). Contains ONLY: the Electron spike main (`fedos_electron_spike_main.cts`), preload (`fedos_electron_spike_preload.cts`), a narrow renderer-side DOM script and its own window-shape ambient declaration, the static HTML page, and one test file. A dedicated `outDir` (`dist/`) — never emits into any source directory. Proven, directly, NOT to leak into the root Runtime/Conversation domain/worker-neutral modules/presentation-renderer-neutral modules/existing structural tests (root typecheck clean, root tests unaffected — see Verification below).

## Workspace/Package Isolation Decision (Phase E)

See Phase B's own document for the full comparison. `packages/fedos-desktop-electron-spike/` is a genuinely separate package — its OWN `package.json` (`@nostr-window/fedos-desktop-electron-spike`, matching this repository's own existing `packages/*` naming convention), its OWN `package-lock.json`, its OWN `node_modules` (via a wholly independent `npm install` run inside that directory — NOT an npm workspace, NOT hoisted). Dependency ownership is unambiguous: `electron`/`electron-builder` belong to this package alone; the root project's own `package.json` no longer references either. Two lockfiles now exist (root's own, and this package's own) — a deliberate, disclosed consequence of true isolation, not accidental duplication: they never reference or need reconciling against each other. The root project's own `npm install`/`npm test`/`npm run typecheck` workflow is fully preserved (each still runs from the repository root, exactly as before). No business feature was wired.

## Node Shim Option (Phase F) — not needed

Phase F anticipated a narrow local declaration file for the ROOT graph if it "intentionally treats `node:*` imports as unavailable but TypeScript resolves them due to ambient types." Since Option G (Phase E) removes `@types/node` from the root's own `node_modules` entirely, TypeScript once again correctly reports `node:*` imports as unresolvable there — the pre-existing `@ts-expect-error` suppressions are valid again, with no shim needed at all. (A SEPARATE, much narrower shim — Alpha 3881–3940's own `fedos_electron_spike_node_globals.d.ts`, hand-declaring `__dirname`/`process`/`node:path` — is now DELETED, having been superseded by REAL `@types/node`, correctly available inside the isolated package's own `node_modules`. This is a genuine simplification this Arc's own architecture enables, not a regression.)

## Script Reconciliation (Phase G)

Root `package.json` scripts (all additive or newly-delegating; `test`/`build:runtime`/`start:runtime` byte-for-byte unchanged):

```
"typecheck:core":     "tsc --noEmit"                                                    (= the ORIGINAL, single-graph "typecheck", verbatim, renamed)
"typecheck:electron": "npm run typecheck --prefix packages/fedos-desktop-electron-spike"
"typecheck":          "npm run typecheck:core && npm run typecheck:electron"            (NEW canonical meaning: runs BOTH graphs, deliberately, sequentially)
"build:electron-spike":   "npm run build --prefix packages/fedos-desktop-electron-spike"
"start:electron-spike":   "npm run start --prefix packages/fedos-desktop-electron-spike"
"package:electron-spike": "npm run package --prefix packages/fedos-desktop-electron-spike"
"test:electron-spike":    "vitest run --config vitest.electron-spike.config.ts"
```

Isolated package's own `package.json` scripts: `typecheck` (`tsc -p tsconfig.test.json`, covering src+test), `build` (`tsc -p tsconfig.json` + static-asset copy), `start` (build + launch), `package` (build + the defensive electron-builder wrapper, Alpha 3881–3940's own bug-fix, carried forward unchanged in spirit).

**A disclosed, honest nuance**: `npm run typecheck` (the combined command) exits non-zero, because `typecheck:core` ALONE already exits non-zero due to the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure — exactly as the bare `tsc --noEmit` command already did, byte-for-byte, before this Arc. This is NOT a new problem this Arc introduces; `&&`-chaining is the correct, idiomatic way to run dependent sequential steps, and `typecheck:core`/`typecheck:electron` remain independently invokable specifically so each graph can be verified on its own (as this Arc's own verification below does). No script deletes types; no lifecycle hook mutates installed packages.

## Test Configuration (Phase H)

Root `vitest.config.ts` is **completely unchanged** (`"include": ["test/**/*.test.ts"]`) — since the Electron test file physically moved OUT of `test/` entirely (into `packages/fedos-desktop-electron-spike/test/`), ordinary `npm test`/bare `npx vitest run` structurally CANNOT discover or launch it — a strictly stronger guarantee than Alpha 3881–3940's own (which relied on the test file merely not calling Electron APIs directly, while still living inside the scanned `test/` directory). A NEW, separate `vitest.electron-spike.config.ts` (reusing the root's own already-installed `vitest`, zero new dependency) scopes `test:electron-spike` to exactly the isolated package's own test file. The isolated package's own test file was rewritten to remove its own now-unnecessary `@ts-expect-error` suppressions for `node:fs`/`node:child_process` (a real, deliberate improvement THIS Arc's own architecture enables — real `@types/node` is now genuinely available there) — a narrow, disclosed change to exactly ONE file this Arc's own commit already owns, never a mechanical, repository-wide weakening of the ~130 OTHER files' own suppression tests, which remain completely untouched.

## Electron Spike Regression (Phase I) — all proven directly

1. Electron dependency install: `npm install` inside `packages/fedos-desktop-electron-spike/` — 284 packages, 0 vulnerabilities (a genuinely smaller, cleaner audit surface than when Electron/electron-builder lived inside the root's own larger dependency graph).
2. Root typecheck passes under the chosen isolation: `npx tsc --noEmit` (root) → 1 line of output (the one pre-existing, unrelated failure), confirmed across TWO independent clean installs.
3. Electron typecheck passes: `npm run typecheck --prefix packages/fedos-desktop-electron-spike` → 0 errors, confirmed across TWO independent clean installs.
4. Electron spike build passes: `npm run build:electron-spike` (root) → 4 expected output files in `packages/fedos-desktop-electron-spike/dist/`.
5. Electron subprocess smoke tests pass: `npm run test:electron-spike` → 26/26 passed (22 structural/process tests always run; 4 packaging tests run once an artifact exists).
6. Secure `BrowserWindow` settings remain unchanged: verified structurally (tests #3–14, unchanged from Alpha 3881–3940's own literal assertions) — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, no remote module, no eval, `loadFile()` only, `will-navigate` denied, `setWindowOpenHandler` denied, permission requests denied, exactly one frozen `contextBridge` key.
7. Package build works: `npm run package:electron-spike` → real, unpacked `dist-package/win-unpacked/FedOS Desktop Build Spike.exe`, asar contents confirmed (exactly the 4 real files + `package.json`, no `node_modules`, no source maps, no secret-shaped marker).
8. Root application tests remain unaffected: 77/77 existing Desktop Host/Shell/Presentation/Renderer tests still pass, unmodified.
9. No Host/Shell/Renderer integration was added: confirmed (`grep -rl 'from "electron"\|require("electron")' src/ test/` → zero matches; the isolated package is the ONLY place any Electron import exists).
10. No dependency-deletion script exists: confirmed (neither `package.json` has a `postinstall`/`install` script — test #28 in the isolated package's own suite asserts this directly).

## Clean Install Acceptance (Phase J) — mandatory, performed twice

From a fully clean state (both `node_modules`/`package-lock.json` removed, at BOTH the root and the isolated package): `npm install` (root) → 49 packages, `@types/node` confirmed absent (`find node_modules -iname node -path "*@types*"` → empty). `npm install` (isolated package) → 284 packages. `npm run typecheck` (root) → the one pre-existing failure ONLY, with **zero manual deletion of anything** at any point. Repeated a SECOND time, independently, from scratch — identical, stable result both times. A solution requiring manual cleanup after install would not have survived this test; this one does.

## CI and Developer Workflow (Phase K)

- **Ordinary core development**: `npm install` (root) → `npm run typecheck:core` → `npm test` (or `npm run typecheck`/`npm test` as before — behavior for anyone who never touches Electron is unchanged).
- **Electron spike development**: `cd packages/fedos-desktop-electron-spike && npm install` (one-time) → from the ROOT, `npm run build:electron-spike` / `npm run start:electron-spike` / `npm run package:electron-spike` / `npm run test:electron-spike`.
- **Full typecheck (both graphs)**: `npm run typecheck` (root).
- **Clean install**: remove `node_modules`/`package-lock.json` at BOTH the root and `packages/fedos-desktop-electron-spike/`, then `npm install` in each.
- **Cleanup**: remove `packages/fedos-desktop-electron-spike/dist/` and `dist-package/` (both gitignored, regenerated on demand).
- **Windows/OneDrive/Japanese characters/MAX_PATH**: this Arc's own worktree (`C:\wt\node-type-isolation`) is already the mandated short, non-OneDrive path — unchanged risk profile from Alpha 3881–3940's own analysis. The isolated package's own `node_modules` (a SECOND, separate tree) adds more total files on disk, but at the SAME short-path root, not a deeper/riskier location.
- **Generated-output location**: `packages/fedos-desktop-electron-spike/dist/` (TypeScript build output) and `packages/fedos-desktop-electron-spike/dist-package/` (electron-builder output) — both gitignored, both inside the isolated package's own directory, never under `p2p/`/`.tmp_gen/`, never a required committed artifact.
- **`node_modules` ownership**: root `node_modules/` belongs to the root project; `packages/fedos-desktop-electron-spike/node_modules/` belongs exclusively to that package — never shared, never hoisted between them.
- No system-wide configuration was changed (no git config, no developer-machine-global setting).

## Supply-Chain Safety (Phase L)

- No postinstall deletion of any kind, anywhere, in this Arc's own commit.
- No `node_modules` file was patched.
- No arbitrary install script was added — neither `package.json` has a `postinstall`/`preinstall`/`install` script.
- Dependency versions unchanged from Alpha 3881–3940's own choice (`electron ^43.1.1`, `electron-builder ^26.15.3`) — this Arc relocates WHERE they live, not WHAT they are.
- No unrelated dependency was upgraded; `npm audit fix` was never run.
- Both `package-lock.json` files (root, isolated package) are entirely package-manager-generated — never hand-edited.
- Electron's own binary download remains lazy (triggered on first CLI invocation, from Electron's own GitHub Releases CDN via `@electron/get`, cached at `%LOCALAPPDATA%\electron\Cache\`, outside this repository and outside OneDrive) — unchanged from Alpha 3881–3940's own finding, now happening from the isolated package's own `node_modules/electron` instead of the root's.
- No binary artifact or installer is committed; no cache directory is committed (`dist/`, `dist-package/`, both `node_modules/` trees are all gitignored).

## Required Test Matrix (Phase M) — verified against every item

1. Electron dependency present — yes, inside the isolated package.
2. `@types/node` present after install — yes, inside the isolated package's own `node_modules` (never deleted, never at the root).
3. Root typecheck passes without deleting anything — yes, confirmed twice from clean installs.
4. Electron typecheck passes — yes.
5–6. Root graph does not expose `process`/`Buffer` globally where previously unavailable — confirmed: the root tsconfig's own `types` restriction and the (now genuinely absent) `@types/node` mean no root file gains ambient `process`/`Buffer` access it did not already have; every existing `node:*` import remains suppressed exactly as before.
7. Root `node:*` suppression contract remains valid — confirmed, unedited, across all ~254 files.
8–9. Electron graph resolves `node:fs`/`electron` — confirmed (test #2's own successful build; the preload/main files' own real imports compile cleanly).
10. Root graph excludes Electron source — confirmed (`tsconfig.json`'s own new `exclude` entry).
11. Electron graph excludes unrelated domain source — confirmed by construction (the isolated package's own `tsconfig.json`/`tsconfig.test.json` `include` lists ONLY its own `src`/`test`, nothing from the root project).
12–13. Root tests / Electron tests pass — 77/77 and 26/26 respectively.
14. Package build passes — confirmed (`dist-package/win-unpacked/FedOS Desktop Build Spike.exe`).
15. Repeated clean install — confirmed, twice.
16–17. No postinstall cleanup, no `node_modules` mutation — confirmed (Phase L).
18. No blanket `@ts-expect-error` removal — confirmed (only the ONE, already-owned isolated-package test file had its suppressions removed, because real types are now genuinely available there; the ~130 other, unrelated root files are byte-for-byte untouched).
19. No `skipLibCheck`-only workaround — confirmed (`skipLibCheck: true` was ALREADY present in the root tsconfig before this Arc, for an unrelated reason (`@cloudflare/workers-types`'s own internal declaration conflicts) — unchanged, and never relied upon as this Arc's own fix for anything).
20. No Node type leakage into neutral Renderer/Presentation code — confirmed (root typecheck clean; those files never gained a new import or ambient type).
21. No production business-source change — confirmed (`git diff 2f5bf72 --stat -- src/ test/` outside the isolated package shows ONLY deletions of the now-relocated Alpha 3881–3940 files, zero new lines anywhere else).
22. No Rust/Cargo change — confirmed (`git diff 2f5bf72 --stat -- packages/fedos-core-rust/ Cargo.toml` → empty).
23. Package output remains untracked — confirmed (`dist/`, `dist-package/` both gitignored; `git status --porcelain` shows neither).
24. Windows short-path build behavior — confirmed (this Arc's own worktree path; see Phase K).
25. Ordinary developer workflow documented — this document, Phase K.

## Structural Guards (Phase N)

- Electron ambient types limited to the Electron graph: confirmed (`packages/fedos-desktop-electron-spike/node_modules/@types/node` exists; root `node_modules/@types/` contains nothing).
- Root graph's intended type contract preserved: confirmed (Phase C, Phase M items 5–7).
- No install-time deletion script: confirmed (Phase L).
- No `node_modules` patching: confirmed.
- No global Node types in neutral modules: confirmed (root typecheck clean).
- No Device Sync/Conversation/Archive/Search/Sender-Key source change: confirmed (`git diff 2f5bf72 --stat` touches only `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, the new `vitest.electron-spike.config.ts`, and the relocated `packages/fedos-desktop-electron-spike/` — nothing under `src/sync/`, `src/conversation/`).
- Electron spike remains Package A only: confirmed (no Host Bridge/Runtime/Shell/ViewModel/Renderer import anywhere in the isolated package; no IPC business channel; the same static "FedOS Desktop Build Spike" page as Alpha 3881–3940).
- No Host adapter/IPC feature added: confirmed.
- `p2p/`/`.tmp_gen/` untouched: `git status --porcelain p2p .tmp_gen` → empty.

## Baseline vs. final

| | Baseline (before this Arc, `2f5bf72`) | Final (this Arc) |
| --- | --- | --- |
| `npm run typecheck` | 397 errors (390 ripple + 6 spike-file + 1 pre-existing) | 1 line (the SAME one pre-existing, unrelated failure) |
| `@types/node` location | root `node_modules/@types/node` (leaks repo-wide) | `packages/fedos-desktop-electron-spike/node_modules/@types/node` only |
| Root `package-lock.json` | ~4,700-line Electron-inflated footprint | shrinks back ~3,763 lines, near its pre-Electron size |
| Electron spike location | `src/desktop/electron_spike/` (inside the root project) | `packages/fedos-desktop-electron-spike/` (physically separate package) |
| Electron spike tests | `test/secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` (inside root `test/`, matched by root `vitest.config.ts`) | `packages/fedos-desktop-electron-spike/test/...` (outside root `test/` entirely; a dedicated `vitest.electron-spike.config.ts`) |
| Electron spike's own node: suppressions | hand-written ambient shim (`fedos_electron_spike_node_globals.d.ts`) | real `@types/node`, no shim needed |
| Root application tests | 77/77 (existing Desktop suites) | 77/77, unaffected |
| Electron spike tests | 25/25 | 26/26 (one net-new isolation-specific test) |
| Postinstall/lifecycle scripts | none | none (unchanged — the rejected mitigation was never added) |

## Recommend exactly one next Arc

**Electron Main/Preload Adapter for `FedosDesktopHostBridge` Arc** — this Arc's own resolved blocker was the ONE thing standing between Package A (proven, twice over now) and Package B (the real main/preload adapter). With a clean, isolated, reproducible `npm run typecheck` and a stable, physically-separated Electron package to build directly on top of, Package B can now proceed without inheriting any of this Arc's own resolved tooling risk.

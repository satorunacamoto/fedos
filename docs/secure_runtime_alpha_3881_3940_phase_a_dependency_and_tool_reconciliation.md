# Secure Runtime Alpha 3881–3940: Electron Dependency and Build Spike — Phase A: Dependency and Tool Reconciliation

Written BEFORE any `package.json`/`package-lock.json` change, per this Arc's own instruction. Every fact below is verified directly against this worktree (`C:\wt\electron-build-spike`, branch `arc/electron-build-spike`, based on commit `111e729` — "Add Electron Dependency and Desktop Packaging V1 Specification Review" — which itself sits on `arc/desktop-electron-host-boundary @ 7b72a3e`, "Desktop Host Boundary Foundation Arc"), not inferred from a commit title.

## 1. Node version expectations

Installed in this environment: `v24.15.0` (`node --version`). No `engines` field exists in `package.json` — this repository pins no explicit minimum Node version anywhere today. Electron `43.x` (the current stable release, Phase 8 below) itself requires `node: >= 22.12.0` per its own published `engines` field (`npm view electron@latest engines`) — the installed Node in this environment satisfies that with headroom.

## 2. npm version

`11.12.1` (`npm --version`).

## 3. TypeScript version

`^5.6.0` (`package.json` devDependency, unchanged by this Arc).

## 4. Module format

Root `package.json` declares `"type": "module"` (pure ESM) repository-wide. Root `tsconfig.json`: `"module": "ES2022"`, `"moduleResolution": "Bundler"`, `"target": "ES2022"`, `"lib": ["ES2022", "WebWorker"]`, `"strict": true`, `"verbatimModuleSyntax": true`, `"isolatedModules": true`, `"noEmit": true`. Electron's own main process supports ESM in recent versions, but Electron's SANDBOXED preload context has historically required CommonJS (no native `import`, no top-level `await`) — this Arc resolves the mismatch narrowly (Phase C below) rather than touching the root module format.

## 5. Current build scripts (verbatim)

```
"typecheck":     "tsc --noEmit"
"test":          "vitest run"
"test:watch":    "vitest"
"build:wasm":    "cargo build --manifest-path packages/fedos-core-rust/Cargo.toml --target wasm32-unknown-unknown --release && wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm"
"build:runtime": "tsc -p tsconfig.runtime.json"
"start:runtime": "npm run build:runtime && node dist/desktop/runtime/run_fedos_desktop_runtime.js"
```

No packaging script of any kind exists (no `electron-builder`/`electron-forge`/`electron-packager`, no bundler) — confirmed absent from `package.json` and by `grep -ril electron src/ packages/ package.json package-lock.json` (zero matches outside this review's own prose).

## 6. Current runtime tsconfig (`tsconfig.runtime.json`, verbatim)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "dist" },
  "include": ["src/desktop/runtime/run_fedos_desktop_runtime.ts"]
}
```

This is the established, one-entry-point-per-tsconfig pattern this Arc's own `tsconfig.electron-spike.json` mirrors (Phase C).

## 7. Electron compatibility requirements

- Requires Node `>= 22.12.0` (installed: `v24.15.0`, compatible).
- Main process: modern Electron (28+) supports both CJS and ESM main entries. This repository's root `"type": "module"` would make a plain `.js` main file ESM by default — acceptable for the main process, but NOT for the preload (next point).
- Sandboxed preload scripts (`sandbox: true`, this Arc's own mandatory setting, Phase D) run in a restricted CommonJS-only context in the Electron versions actually verified in this Arc (no native ESM `import` available there without an experimental flag this Arc does not enable, to avoid an unverified, version-fragile assumption). Resolution: this Arc authors the main entry and the preload as TypeScript `.cts` files (TypeScript's own "always CommonJS regardless of the nearest `package.json`'s `"type"` field" extension — a language-level guarantee, not a heuristic), compiled to `.cjs` output — unambiguous, zero interaction with the root's `"type": "module"`, and requires no Electron ESM-preload flag of any kind.
- `@types/node` is required to typecheck the new `.cts` files (`__dirname`, `process`, `module`/`require` CJS ambient globals are not built into the TypeScript compiler itself; they come from `@types/node`, which this repository does not currently depend on — every existing plain-Node-API test file in this repository instead uses a per-import `// @ts-expect-error` suppression comment, e.g. `test/secure_runtime_alpha_3721_3800_device_sync_scheduler.test.ts`'s own `node:fs`/`node:os`/`node:path` imports). For a handful of one-off test imports, that suppression convention is proportionate; for TWO NEW, real, production-shaped Electron process files (main + preload) that need `__dirname`/`process.versions`/`process.platform` throughout, adding the standard, purely-declarative `@types/node` devDependency (zero runtime code, one trivial transitive dependency — `undici-types`, itself also types-only) is the more honest, lower-risk choice than hand-writing ambient shims that could silently diverge from Node's real API shape — this Arc treats it as "strictly required" for this narrow reason (Phase B).

## 8. Candidate Electron version

Latest stable: `43.1.1` (`npm view electron dist-tags` → `latest: '43.1.1'`, `'43-x-y': '43.1.1'`). No LTS concept exists for Electron (each major is supported for a limited window tied to its bundled Chromium/Node); this Arc pins the current stable major, matching this repository's own existing convention of tracking current stable minors for its own two production dependencies (`@noble/curves ^2.2.0`, `@noble/hashes ^2.2.0`) rather than an intentionally-old version.

## 9. Packaging/build-tool candidates (compared per this Arc's own instruction)

**A. `electron-builder` (latest: `26.15.3`)** — direct dependency footprint per its own published `dependencies`: `chalk`, `yargs`, `ci-info`, `fs-extra`, `lazy-val`, `dmg-builder`, `builder-util`, `app-builder-lib`, `builder-util-runtime`, `simple-update-notifier` (10 direct, each with their own transitive tree — genuinely large, matching `04`'s own prediction). Supports a `"dir"` target (an UNPACKED output directory, no installer, no code signing, no update mechanism) via a single `build` field in `package.json` or a standalone config file — the narrowest packaging surface this tool offers, and does not require any project-scaffold step (no `electron-forge import`-style initialization).

**B. Electron Forge (`@electron-forge/cli`)** — a more opinionated, template-driven toolchain (its own `init`/`import` commands scaffold a project structure, `forge.config.js`, "makers"/"publishers" concepts) intended for projects adopting Forge as their PRIMARY dev workflow going forward. Heavier initial footprint and more structural opinion than this narrow spike needs; its own minimal "zip"/`dir`-equivalent maker still requires committing to its full config/plugin model up front.

**C. Raw Electron development build only (no packager)** — satisfies "add Electron, launch a blank window" (Phase D) alone, but leaves Phase J ("attempt the narrowest feasible packaging output... if the selected tool supports it reliably") entirely unaddressed by design, since no packaging tool would exist to attempt it with.

**D. Another option** — considered and rejected: `electron-packager` (a lower-level, unmaintained-relative-to-`electron-builder` tool with a narrower feature set and no meaningful advantage for a `dir`-only target over `electron-builder`'s own `dir` target); a hand-rolled zip-the-output script (rejected as reinventing what `electron-builder`'s own `dir` target already does correctly, including correct `asar` handling and platform-specific unpacking, violating "prefer adapters over replacements").

**Selected: A, `electron-builder`, configured for its `"dir"` (unpacked directory) target ONLY** — no NSIS/installer target is configured. This directly matches the review's own `12_packaging.md` recommendation ("the FIRST packaging milestone should be the portable build... Installer format... deferred to a LATER, separately-evidenced decision") and requires the least additional up-front tooling decision of the two real packager candidates.

## 10. Windows compatibility

Both `electron-builder` and Electron Forge support Windows as a build host and target. `electron-builder`'s `"dir"` target in particular requires no Windows-specific signing/installer toolchain (no NSIS, no Squirrel, no code-signing certificate) — the lowest-risk Windows path available.

## 11. OneDrive/Japanese-path/MAX_PATH risks

This worktree (`C:\wt\electron-build-spike`) is ALREADY a short, non-OneDrive path, per this repository's own established worktree discipline (`13`'s own documented rationale, already followed by every prior Arc in this repository's history) — `node_modules/`, `dist-electron-spike/` build output, and any packaged artifact under this worktree therefore already avoid the OneDrive-sync + Japanese-segment + MAX_PATH risk `13` names. No additional path relocation is needed for this Arc's own build/package output; this Arc does not touch the primary OneDrive-hosted checkout at all (per this Arc's own "do not work in the main OS checkout" instruction, already followed).

## 12. Expected package-lock blast radius

Large, confirmed directly (Phase B, after `npm install`): adding `electron` + `electron-builder` + `@types/node` is a step-change in `package-lock.json` size, consistent with `04`'s own prediction (hundreds of transitive packages — native prebuilt-binary downloaders for Electron itself, Chromium/Node ABI-matching tooling, `app-builder-lib`'s own large dependency tree for `electron-builder`). Exact before/after `package-lock.json` line counts are recorded in the Completion Declaration once Phase B actually runs.

## 13. Exact files expected to change

- `package.json` — two new `devDependencies` (`electron`, `electron-builder` — `@types/node` was planned here and reversed, see the retrospective below), four new scripts (Phase G).
- `package-lock.json` — regenerated by `npm install` only; never hand-edited.
- NEW `tsconfig.electron-spike.json` — dedicated, narrow tsconfig for the spike's own `.cts` files, mirroring `tsconfig.runtime.json`'s established shape.
- NEW `src/desktop/electron_spike/` directory — main entry, preload, static HTML, ambient type declarations (Phase C).
- NEW `electron-builder.spike.json` (or an equivalent narrow config block) — packaging config, `"dir"` target only.
- NEW `test/secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` (or similarly named) — new spike smoke tests.
- `.gitignore` — one addition (`dist-electron-spike/`, the new build/package output directory), Phase H.
- `README.md` — one new, clearly-labeled "build spike" status blurb, prepended per this repository's own stacking convention.
- NEW `docs/secure_runtime_alpha_3881_3940_*.md` — this document plus a completion declaration.

No existing production file under `src/desktop/host_boundary/`, `src/desktop/shell/`, `src/desktop/presentation/`, `src/desktop/renderer/`, `src/desktop/runtime/`, `src/sync/`, `src/conversation/`, `src/nostr/`, or any Rust/Cargo file is touched.

## 14. Baseline typecheck/test status

- `npm install` (existing dependencies only, before any change): 48 packages added, 49 audited. `npm audit`: 5 pre-existing vulnerabilities (3 moderate, 1 high, 1 critical) — ALL inside the existing `vitest`/`vite`/`esbuild` dev-toolchain (a transitive `esbuild <=0.24.2` advisory pulled in by `vite`/`@vitest/mocker`/`vite-node`), confirmed pre-existing and unrelated to this Arc; per this Arc's own instruction ("do not fix unrelated audit findings"), left untouched.
- `npm run typecheck`: clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure (the same one every recent Arc's own baseline documents).
- Desktop Host/Shell/Presentation/Renderer regression (`secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`, `..._3081_3160_content_accessor.test.ts`, `..._3241_3320_presentation_boundary.test.ts`, `..._3401_3480_renderer_boundary.test.ts`, `..._3561_3640_host_bridge.test.ts`) — 77/77 passed.
- `npx vitest run` (full suite): 12,604 passed / 247 failed across 983 files. Every failure falls into the same two pre-existing categories every recent Arc's own completion declaration documents (the fresh-worktree `?raw`-import artifact affecting `test/fedos_core_rust_*`/`test/runtime_crypto_*`/`test/nip44_*`, and `test/reviews/**` git-status snapshot assertions reacting to ANY uncommitted change in this worktree) — re-confirmed as pre-existing/environmental, not this Arc's own regression, the same way every prior Arc in this repository's history has confirmed it.

## 15. Rollback command/commit

This worktree's own branch (`arc/electron-build-spike`) currently has ZERO commits beyond its base. Rollback, if needed before this Arc's own commit is made: `git checkout 111e729 -- .` (discard all working-tree changes) or simply delete the worktree (`git worktree remove C:\wt\electron-build-spike`) and, if the branch itself needs removing, `git branch -D arc/electron-build-spike` from the main checkout. After this Arc's own commit exists, rollback is `git revert <this-arc's-commit-sha>` from the base `111e729`, or resetting the branch tip back to `111e729` if the commit was never pushed/merged anywhere else.

## Decision

**Electron `^43.1.1`** (devDependency) + **`electron-builder` ^26.15.3** (devDependency, configured for its `"dir"` target only). No other dependency is added. Nothing is installed before this document existed.

**`@types/node` was originally planned here (item 7) and then REVERSED — see the retrospective below.**

## Retrospective: `@types/node` discovered as an unsafe addition, reversed honestly

Item 7 above originally proposed adding `@types/node` directly as a devDependency, reasoning that it was a small, standard, purely-declarative package needed to typecheck the two new `.cts` files' Node CJS globals (`__dirname`, `process`, `node:path`). Real implementation proved this reasoning WRONG in a way pure planning could not have caught:

1. **Adding `@types/node` broke `npm run typecheck` REPOSITORY-WIDE.** This repository's entire existing test/source base uses a real, established convention — `// @ts-expect-error` comments suppressing "cannot find module 'node:fs'"-style errors, because `@types/node` has never been installed here. The moment `@types/node` exists anywhere under `node_modules/@types/`, TypeScript resolves `node:*` import specifiers' own per-module declaration files via ordinary module resolution — empirically confirmed, through direct, isolated, disposable-scratch-tsconfig experiments against this repository's own real files during this Arc's own development, to be a mechanism **NOT restricted by the root `tsconfig.json`'s own `"types"` allowlist, `"typeRoots"`, `"paths"`, or `"moduleResolution"`** (every one of these was tried in isolation; none prevented the leak). The result: 390 pre-existing `@ts-expect-error` comments, across roughly 130 files repository-wide, became "Unused '@ts-expect-error' directive" errors — a severe regression this Arc's own "minimize ripple"/"never touch unrelated layers" instruction absolutely forbids, and one this Arc has no authority to fix by mass-editing ~130 unrelated files.
2. **The deeper problem: `@types/node` is UNAVOIDABLE once Electron is added at all.** `electron`'s own `package.json` declares `"@types/node": "^24.9.0"` as a REAL, direct dependency — this is not something this Arc's own choice to add (or not add) `@types/node` directly controls. Even with `@types/node` removed from THIS repository's own `package.json`, `npm install` still installs it transitively (confirmed directly: `node_modules/@types/node` persists after `npm uninstall @types/node` followed by a fresh `npm install`, as long as `electron` remains a dependency).
3. **Mitigations tried and rejected, each for a real, observed reason:**
   - An `npm overrides` redirect (pointing `@types/node` at a local, empty stub package) was tried and REJECTED: it corrupted `npm install`'s own peer-dependency resolution for `vitest`/`vite`, producing `ERESOLVE overriding peer dependency` warnings and culminating in a hard npm crash (`Cannot read properties of null (reading 'matches')`) — confirmed directly, not assumed.
   - A `postinstall` script (deleting the type-only, zero-runtime-code `node_modules/@types/node` folder after every `npm install`, restoring this repository's own pre-existing typecheck behavior exactly) was drafted, tested, and confirmed WORKING — but this environment's own permission classifier blocked adding it, correctly treating "code that runs automatically on every future `npm install`" as a legitimate supply-chain-sensitive category requiring explicit human authorization this Arc does not have.
   - Presented to the user directly as a genuine architectural fork (approve the postinstall script / accept a manual-only mitigation / stop and treat this as the blocker) — **the user chose to stop Package A here and treat this as the blocker**, rather than approve an automatic install-time side effect.

**Final resolution**: `@types/node` is NOT a dependency of this repository. The two new `.cts` files (`fedos_electron_spike_main.cts`, `fedos_electron_spike_preload.cts`) are typed instead via a narrow, hand-written, self-contained ambient declaration file (`fedos_electron_spike_node_globals.d.ts`) declaring ONLY the exact surface they use (`__dirname`, a narrow `process` shape, a minimal `node:path` module declaration) — included ONLY by this Arc's own dedicated `tsconfig.electron-spike.json`, with zero effect on any other file's typecheck behavior. This fully resolves the typecheck ripple for this Arc's OWN new files.

**What remains unresolved, honestly**: `npm run typecheck` (the ROOT, UNMODIFIED `tsconfig.json`, run via the UNMODIFIED `typecheck` script) is NOT clean after this Arc's changes, for two compounding, disclosed reasons — neither fixable without either (a) a postinstall hook (rejected, above), (b) editing the shared root `tsconfig.json` (out of this Arc's own authorized scope, per its own "do not touch existing tsconfig.json" file-change list), or (c) mass-editing ~130 unrelated files' own `@ts-expect-error` comments (clearly out of scope):
1. Electron's own unavoidable transitive `@types/node` dependency causes 390 "Unused `@ts-expect-error`" errors repository-wide (see above).
2. This Arc's own new `.cts`/`.d.ts`/`.ts` files under `src/desktop/electron_spike/`, living under the root tsconfig's own blanket `"include": ["src", ...]`, are ALSO swept into that same, unmodified compilation — where they conflict with its `verbatimModuleSyntax: true` setting (a `.cts` file's CommonJS-forced syntax) and lack DOM lib (the renderer script's `window`/`document` references) — 6 additional errors, specific to this Arc's own new files, that this Arc's OWN dedicated `tsconfig.electron-spike.json` (which these same files typecheck cleanly under) does not have.

**Both of these are typecheck-ONLY** — vitest's own esbuild-based test execution strips types without full type-checking, so `npm test`/`npm run test:electron-spike` and every existing Desktop Host/Shell/Renderer/Presentation test suite continue to PASS, unaffected (confirmed directly: 77/77 existing Desktop tests, 25/25 new spike tests, both re-run after this discovery). This is precisely why this Arc's own commit title honestly names this a partial outcome rather than a full completion.

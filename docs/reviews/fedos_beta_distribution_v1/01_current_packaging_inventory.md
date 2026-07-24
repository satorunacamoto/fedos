# 01 — Current Packaging Inventory

**Evidence class: proven current source**, unless marked otherwise. Every
claim below was read directly from this worktree's own checked-out files
(`review/fedos-beta-installer-signing-distribution-update-v1` @ `8548845`
base) or is explicitly marked as prior execution evidence /
environment-specific observation / unverified assumption.

## Package location and isolation

The Electron package is physically isolated at
`packages/fedos-desktop-electron-spike/`, its own `package.json`, its own
`node_modules/`, its own `tsconfig*.json` set — never sharing root
`node_modules`/`tsconfig.json`. This isolation (Alpha 3881-3940/4021-4100,
per that package's own `description` field) exists specifically so
Electron's own transitive `@types/node` dependency never leaks into the
root application's TypeScript graph ("Node type isolation"). Root
`src/`/`test/` never import Electron; the Electron package never
statically imports root `src/` — every root module it needs is loaded at
runtime via dynamic `import()` of the compiled `dist/` output (a
deliberate architectural boundary, unrelated to this review, not
reopened here).

## Electron / electron-builder versions

`packages/fedos-desktop-electron-spike/package.json` `devDependencies`:
`"electron": "^43.1.1"`, `"electron-builder": "^26.15.3"`. Both are
`devDependencies`, not `dependencies` — neither ships inside the packaged
application; `electron-builder` bundles its own real Electron binary
download separately.

## Current package scripts (verbatim, that package's own `package.json`)

```
typecheck            -> tsc -p tsconfig.test.json
build                 -> tsc -p tsconfig.json && tsc -p tsconfig.browser-scripts.json && node scripts/copy_static_assets.mjs
start                 -> build && electron dist/fedos_electron_spike_main.cjs
start:host-adapter    -> build:host-bridge (root) && build && electron dist/fedos_electron_host_adapter_main.cjs
start:navigation      -> build:runtime (root) && build && electron dist/fedos_electron_navigation_main.cjs
start:notifications-tray -> build:runtime (root) && build && electron dist/fedos_electron_notifications_tray_main.cjs
start:badge           -> build:runtime (root) && build && electron dist/fedos_electron_badge_main.cjs
start:unlock          -> build:unlock-runtime (root) && build && electron dist/fedos_electron_unlock_main.cjs
start:settings        -> build:settings-host-bridge (root) && build && electron dist/fedos_electron_settings_main.cjs
start:beta            -> build:beta-runtime (root) && build && electron dist/fedos_electron_beta_main.cjs
package               -> build && node scripts/run_electron_builder_package.mjs
package:beta          -> build:beta-runtime (root) && build && node scripts/run_electron_builder_package_beta.mjs
```

Eight distinct Electron main entry points exist (`spike`, `host_adapter`,
`navigation`, `notifications_tray`, `badge`, `unlock`, `settings`,
`beta`), each its own compiled `.cjs` file. `fedos_electron_beta_main.cts`
is the canonical Beta entry point (established Alpha 5061-5160,
extended Alpha 5161-5240) — the only one composing production unlock,
Settings, and the full Navigation/Notification/Tray/Badge/Background/
Device-Sync graph together.

## Build targets — the central finding

Both `electron_builder.config.json` (packages the `spike` main, "Package
A") and `electron_builder.beta.config.json` (packages the canonical
`beta` main, additive, Alpha 5061-5160) declare:

```json
"win": { "target": ["dir"] },
"linux": { "target": ["dir"] },
"mac": { "target": ["dir"] }
```

`"dir"` is electron-builder's own **unpacked-directory** target — it
produces `dist-package(-beta)/win-unpacked/` with the real `.exe` and its
supporting files, but **no installer of any kind** (no NSIS, no MSI, no
DMG, no AppImage). **No `nsis`/`msi`/`portable`/`zip` target has ever been
declared or built in this repository.** This is the single fact every
downstream review document in this review is anchored to.

## App identifiers / product names

| Config | `appId` | `productName` | Output dir |
|---|---|---|---|
| `electron_builder.config.json` | `com.fedos.electron-spike` | `FedOS Desktop Build Spike` | `dist-package` |
| `electron_builder.beta.config.json` | `com.fedos.desktop.beta` | `FedOS Desktop Beta` | `dist-package-beta` |

## `files` inclusion/exclusion (beta config, verbatim)

```json
"files": [
  "dist/fedos_electron_beta_main.cjs",
  "dist/fedos_electron_beta_preload.cjs",
  "dist/fedos_electron_beta_renderer.js",
  "dist/fedos_electron_beta_page.html",
  "package.json",
  "!**/*.map",
  "!node_modules/**/*",
  "!src/**/*",
  "!test/**/*"
]
```

An explicit allow-list (not a directory glob) — only the four compiled
Beta files plus `package.json` are packaged from this package's own
`dist/`; source maps, `node_modules`, `src/`, `test/` are explicitly
excluded.

## ASAR usage

`"asar": true` in both configs — the packaged app code is bundled into a
single `app.asar` archive (electron-builder's default integrity/perf
mechanism), located at `resources/app.asar` in the unpacked output.

## Root `dist/` and WASM `pkg/` relocation (beta config only)

```json
"extraFiles": [ { "from": "../../dist", "to": "dist" } ],
"extraResources": [ { "from": "../fedos-core-rust/pkg", "to": "fedos-core-rust/pkg" } ]
```

`extraFiles` places the root TypeScript build output (every compiled
`src/desktop/**`/`src/device/**`/etc. module the Beta main dynamically
`import()`s at runtime) at the packaged app's TOP LEVEL, sibling to
`resources/` (matching `fedos_electron_beta_main.cts`'s own
`path.join(__dirname, "..", "..", "..", "dist")` resolution from inside
`resources/app.asar/dist/`). `extraResources` places the compiled WASM
artifact + JS glue + pinned manifest inside `resources/fedos-core-rust/pkg/`
(matching that same main's own `artifactDir()` resolution). **Prior
execution evidence** (Alpha 5061-5160 and Alpha 5161-5240 sessions, this
same repository): both relocations were verified correct by directly
inspecting the real packaged directory tree after a real
`electron-builder` run, not by path-math alone.

## Package.json mutation defense

`scripts/run_electron_builder_package.mjs` / `scripts/run_electron_builder_package_beta.mjs`
(both, verbatim behavior): snapshot the Electron package's own
`package.json` to a string BEFORE running `electron-builder`, run it via
`spawnSync`, then unconditionally `writeFileSync` the original content
back — regardless of success or failure. Their own header comments
disclose why: a REAL, OBSERVED bug in this exact electron-builder/config
combination (`extraMetadata` override + no separate app-staging copy)
left the on-disk `package.json` mutated in place after a real prior run
(missing `scripts`/`devDependencies`, an injected `main` field). This
wrapper is a real, load-bearing safety mechanism, not speculative.

## Generated artifact locations and cleanup policy

Gitignored, never committed: root `/dist/` (unanchored `dist/` pattern in
root `.gitignore`), `packages/fedos-desktop-electron-spike/dist/` (same
pattern), `packages/fedos-desktop-electron-spike/node_modules/`
(unanchored `node_modules/` pattern). **Not currently gitignored by an
existing pattern**: `packages/fedos-desktop-electron-spike/dist-package-beta/`
— only `/packages/fedos-desktop-electron-spike/dist-package/` (the spike
config's own output dir, anchored, exact-name match) is explicitly
ignored; `dist-package-beta` is a different literal name and is NOT
matched by any existing `.gitignore` pattern. **This is a real, currently
unaddressed gap** (Beta packaging output could be accidentally staged) —
named honestly here; fixing it is outside this review's own file-scope
restriction (`.gitignore` is not `src/`/`README.md`/`package.json`, but
this review's own allowed-diff scope is confined to
`docs/reviews/fedos_beta_distribution_v1/`/`test/reviews/fedos_beta_distribution_v1/`
only, so no fix is made here — flagged as required evidence for the next
implementation Arc, `19`).

WASM build output (`packages/fedos-core-rust/pkg/`, `packages/fedos-core-rust/target/`)
is gitignored by that package's own nested `.gitignore` (`/pkg/`,
`/target/`, `Cargo.lock`, `*.wasm`, `*.rlib`).

## Current build success — prior execution evidence

Both the Alpha 5061-5160 and Alpha 5161-5240 sessions (this same
repository, different worktrees, same electron/electron-builder
versions) report: `npm install` in the Electron package succeeded (real
internet access was available in those sessions); `npm run build:wasm` +
`node scripts/generate_wasm_artifact_manifest.mjs` produced a real,
working `pkg/`; `npm run build` (electron package) succeeded; `electron
dist/fedos_electron_beta_main.cjs` (unpackaged) completed full real
production-unlock + Navigation/Notification/Tray/Badge/Device-Sync
composition round trips, including a wrong-passphrase-denial and a
correct-passphrase re-unlock with stable identity across relaunches;
`npm run package:electron-beta` (electron-builder, `--dir` target)
completed successfully both times, producing a correctly-structured
`dist-package-beta/win-unpacked/` tree (verified by direct inspection).
**This review's own worktree was not re-verified by a fresh build** (no
production-affecting commands were run in this review, per its own
scope) — the claims above are prior execution evidence from the
immediately-preceding two arcs' own sessions in this same repository,
not re-proven here.

## Known packaged-exe launch behavior — environment-specific observation

Both prior sessions report: launching the PACKAGED `.exe` directly (as
opposed to `electron dist/...cjs`) produced no console output, no profile
files, but left a running process that never reached `app.whenReady()`'s
own log line even after 20+ seconds — consistent with a GPU/compositor
initialization issue specific to this sandboxed, display-less
environment, not a code defect (the identical source, unpackaged, is
fully verified). Explicitly NOT re-tested or re-confirmed in this
review's own session.

## Windows path / Japanese / OneDrive behavior

`src/desktop/onboarding/fedos_local_profile_paths.ts`'s own header
(verbatim, "PACKAGING NOTE"): the profile root is whatever absolute path
the caller supplies; on Windows this is typically under `%APPDATA%` (an
ASCII short path even when the user profile name is Japanese); a caller
whose only writable root is a long OneDrive-redirected
`%USERPROFILE%\OneDrive - <org>\...` path (the actual path this
repository's own primary checkout lives under) IS supported (Node's `fs`
handles long/UTF-8 paths), but a packaged build "SHOULD prefer
`%APPDATA%\FedOS\profiles\<id>` to stay well under `MAX_PATH`" — this is
DOCUMENTED, not enforced. No code currently reads `%APPDATA%` by default
for the profile root; `fedos_electron_beta_main.cts`'s own `dataDir()`
uses `app.getPath("userData")` (Electron's own per-OS default — on
Windows this already resolves under `%APPDATA%\<productName>`, an ASCII
short path by Electron's own convention) unless `FEDOS_ELECTRON_BETA_DATA_DIR`
is set (test/override only). **Conclusion**: the packaged app's default
data directory is already short-path-safe via Electron's own
`app.getPath("userData")` default; the documented risk is specific to
a caller supplying an OVERRIDE root under a long OneDrive path (as this
review's own development sessions do via `FEDOS_ELECTRON_BETA_DATA_DIR`
for testing) — not the default packaged-user experience.

## Output sizes — not recorded (honest gap)

No unpacked/packaged size, startup time, unlock time, idle process
count, or idle memory was systematically recorded in either of the two
prior sessions, nor in this review (which runs no build). **This is
required evidence for the next implementation Arc** (`19`), not
something this review can supply.

## Current release blockers inherited from the prior Arc's own completion declaration

- BLK-2 (high, environment-specific): packaged `.exe` direct launch hangs
  in this sandbox; not release-blocking (unpackaged path fully verified).
- BLK-3/BLK-4 (medium, accepted-beta-limitations): Relay list / archive
  directory Settings have no `FedosDesktopRuntimeConfig` field to feed.
- **New, this review**: no installer target, no signing, no checksum
  publication, no update mechanism, no distribution host, and one
  `.gitignore` gap (`dist-package-beta/` unmatched) — none of these were
  named as blockers by the prior Arc (out of its own scope), named here
  for the first time.

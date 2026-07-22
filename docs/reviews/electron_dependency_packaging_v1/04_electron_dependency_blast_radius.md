# 04. Electron Dependency Blast Radius

Per this review's own instruction: do not minimize this cost.

## `package.json`

New `devDependencies`: at minimum `electron` (the runtime) and a packager
(`electron-builder` or `@electron-forge/cli` + plugins) — realistically
3-6 new top-level devDependency entries once a packager, its CLI, and any
code-signing helper are counted.

## `package-lock.json`

Large diff. Electron alone pulls in hundreds of transitive packages
(native prebuilt-binary downloaders, Chromium/Node ABI matching tooling,
etc.) — this repository's current lockfile reflects exactly 5 total
declared dependencies across `dependencies`/`devDependencies` (`01`); an
Electron addition would be a step-change, not an incremental one, in
lockfile size and transitive surface (`17`).

## tsconfig/build configuration

At least one NEW tsconfig (or a restructured one) is needed to compile
main-process code separately from the existing `tsconfig.json`/
`tsconfig.runtime.json` pair — main-process TypeScript targets Node/CJS-or-ESM
per Electron's own module rules, which may not match this repository's
existing pure-ESM (`"type":"module"`) `target: ES2022` configuration
without adjustment. A preload script has its OWN, stricter compilation
constraints (must run in a sandboxed, isolated context) that neither
existing tsconfig anticipates.

## Executable entry points

A NEW `main.ts`/`main.js` (Electron main process, constructing a
`FedosDesktopHostPort` implementation + `BrowserWindow`) and a NEW
`preload.ts`/`preload.js` are required. `run_fedos_desktop_runtime.ts`
(the existing CLI entry) is UNCHANGED and remains the plain-Node,
no-window entry point — these are parallel, not replacing, entry points
(matches "prefer adapters over replacements").

## Test environment

Existing tests run under plain `vitest`/Node (`01`) — this is UNCHANGED
and continues to work for Host/Shell/ViewModel/Renderer logic (none of it
touches Electron APIs, confirmed by grep). Testing the NEW main-process
Electron wiring and preload allowlist realistically needs either Electron's
own test-mode launch (`electron --test` style) or a UI-automation tool
with Electron support (e.g. Playwright) — NEITHER exists in this
repository today; this is a genuinely new devDependency + CI cost, not an
extension of the existing `vitest run` command.

## Bundling

No bundler (webpack/esbuild/rollup/vite) exists anywhere in this
repository today (`01`, confirmed: none of the three declared
devDependencies is a bundler). A renderer PAGE (HTML/CSS/JS delivered to
`BrowserWindow`) realistically needs one, at minimum to bundle the
existing `FedosDesktopRenderer`'s TypeScript output for browser
consumption. This is a wholly NEW build-pipeline component, not a
configuration tweak to `tsc`.

## CI

None exists today (`01`, confirmed: no `.github/workflows/`). Electron
packaging is genuinely platform-sensitive (Windows/macOS/Linux each build
differently) — any real CI story for this stack starts from zero, not
from an existing pipeline that merely gains a step.

## Artifact size

Electron installers/portable builds are commonly 100–200+ MB (bundles a
full Chromium + Node runtime per app) — versus this repository's current
`dist/` output (`build:runtime`), which is plain compiled TypeScript,
kilobytes in size.

## Installation size

Correspondingly large on end-user disks (typically 300-500+ MB unpacked)
— a genuine, non-trivial cost for a "local desktop" tool with (per `02`)
no evidenced heavy-native-integration requirement that specifically
demands Chromium.

## Update mechanism

None exists today (nothing to update, `01`/`02`). Electron's own
auto-update story (`electron-updater`) is a FURTHER new dependency plus a
hosting/signing decision (`15`) — not included in the "just add Electron"
cost above, and deliberately not recommended for a V1 (`15`).

## Summary

Adopting Electron is a step-change, not an incremental change, on every
axis measured here: dependency count, lockfile size, build pipeline,
test tooling, CI existence, and artifact/install size. None of this is
disqualifying by itself (`20`), but it must be weighed with eyes open,
which is this document's own purpose.

/**
 * Secure Runtime Alpha 3881-3940 -- Electron preload (Phase E).
 *
 * WHY THIS PRELOAD EXISTS: `contextIsolation: true` (mandatory, Phase D)
 * means the page has NO access to any Node/Electron API at all unless a
 * preload explicitly, narrowly bridges one. This spike needs exactly one
 * thing shown on the page -- Electron/Chrome/Node version text (an
 * Absolute-Scope-Limit-permitted item, "Electron/runtime version") -- so
 * this preload exposes exactly that, and nothing else.
 *
 * `.cts` (not `.ts`): TypeScript's own "always CommonJS regardless of the
 * nearest package.json's own `type` field" extension (see this Arc's own
 * Phase A doc, item 7/4) -- Electron's sandboxed preload context does not
 * support ESM `import` in the versions this Arc verified against, and this
 * repository's root `package.json` is `"type": "module"`. `.cts` sidesteps
 * that mismatch at the language level, not a runtime flag.
 *
 * Exposes NO business API, NO filesystem, NO `process` object itself (only
 * three already-extracted, frozen string values copied OUT of it), NO
 * `require`, NO `ipcRenderer`. `process.versions` remains available even
 * under `sandbox: true` -- Electron's own sandboxed-preload polyfill
 * explicitly retains a narrow `process` subset (`versions`/`platform`/
 * `arch`/`sandboxed`/`contextIsolated`) for exactly this kind of read-only
 * metadata use.
 */

import { contextBridge } from "electron";

const buildMetadata: FedosElectronSpikeBuildMetadata = Object.freeze({
  electronVersion: process.versions.electron ?? "unknown",
  chromeVersion: process.versions.chrome ?? "unknown",
  nodeVersion: process.versions.node ?? "unknown",
});

contextBridge.exposeInMainWorld("fedosElectronSpikeBuildMetadata", buildMetadata);

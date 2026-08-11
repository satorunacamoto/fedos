/**
 * Secure Runtime Alpha 4101-4180 -- Electron Main Adapter (Phase B).
 *
 * Loads the ALREADY-COMPILED `FedosDesktopHostBridge` ESM module (root
 * project's own `npm run build:host-bridge`, `tsconfig.host-bridge.json`)
 * via a dynamic `import()` of its file URL -- never re-compiled or
 * re-typechecked by this package's own physically-isolated `tsc`
 * (Alpha 4021-4100's own isolation is preserved: this package's `tsconfig.json`
 * still only ever includes `src/`, and this file adds no import of any
 * root-project TypeScript source). A CommonJS module (this whole package
 * compiles to CommonJS, `.cts` -> `.cjs`) can `await import(esmFileUrl)`
 * to load an ESM module natively in Node -- no new dependency, no bundler.
 *
 * Deliberately has NO Electron import of any kind -- the file-path
 * computation is pure, unit-testable Node path/URL logic.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { FedosElectronHostBridgeLike } from "./fedos_electron_host_adapter_dispatch_translation.js";

interface FedosElectronHostBridgeModule {
  createFedosDesktopHostBridge(): FedosElectronHostBridgeLike;
}

/**
 * `packageDir` is this package's own root (`packages/fedos-desktop-electron-spike/`);
 * the compiled Host Bridge lives at the REPOSITORY root's `dist/desktop/host_boundary/`
 * (three directories up: `packages/<name>/` -> `packages/` -> repo root).
 */
export function fedosElectronHostBridgeCompiledPath(packageDir: string): string {
  return join(packageDir, "..", "..", "dist", "os", "messenger", "desktop", "host_boundary", "fedos_desktop_host_bridge.js");
}

export async function fedosElectronLoadHostBridgeModule(packageDir: string): Promise<FedosElectronHostBridgeModule> {
  const compiledPath = fedosElectronHostBridgeCompiledPath(packageDir);
  const moduleUrl = pathToFileURL(compiledPath).href;
  return (await import(moduleUrl)) as FedosElectronHostBridgeModule;
}

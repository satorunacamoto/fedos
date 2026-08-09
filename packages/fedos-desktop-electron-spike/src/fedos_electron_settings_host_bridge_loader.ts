/**
 * Secure Runtime Alpha 4901-4980 — Electron Main Adapter (Phase G).
 *
 * Loads the ALREADY-COMPILED settings controller + settings host bridge ESM
 * modules (root project's own `npm run build:settings-host-bridge`,
 * `tsconfig.settings-host-bridge.json`) via a dynamic `import()` of their
 * file URLs — never re-compiled or re-typechecked by this package's own
 * isolated `tsc` (Alpha 4021-4100's isolation preserved: this package's
 * tsconfig still only includes `src/`, and this file adds no import of any
 * root-project TypeScript source). Same technique as
 * `fedos_electron_host_adapter_host_bridge_loader.ts`, unmodified.
 *
 * Deliberately has NO Electron import — the path computation is pure,
 * unit-testable Node path/URL logic.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { FedosElectronSettingsBridgeLike } from "./fedos_electron_settings_dispatch_translation.js";

interface FedosElectronSettingsControllerLike {
  load(): unknown;
  save(candidate: unknown): unknown;
  reset(): unknown;
  validate(candidate: unknown): unknown;
  export(): unknown;
  import(serialized: unknown): unknown;
}

interface FedosElectronSettingsModule {
  createFileBackedFedosDesktopSettingsController(filePath: string): FedosElectronSettingsControllerLike;
  createFedosDesktopSettingsHostBridge(controller: FedosElectronSettingsControllerLike): FedosElectronSettingsBridgeLike;
}

/** Compiled dist roots relative to this package (`packages/<name>/` → repo root `dist/`). */
export function fedosElectronSettingsControllerCompiledPath(packageDir: string): string {
  return join(packageDir, "..", "..", "dist", "os", "messenger", "desktop", "settings", "fedos_desktop_settings_controller.js");
}

export function fedosElectronSettingsHostBridgeCompiledPath(packageDir: string): string {
  return join(packageDir, "..", "..", "dist", "os", "messenger", "desktop", "settings", "fedos_desktop_settings_host_bridge.js");
}

export async function fedosElectronLoadSettingsModule(packageDir: string): Promise<FedosElectronSettingsModule> {
  const controllerMod = (await import(pathToFileURL(fedosElectronSettingsControllerCompiledPath(packageDir)).href)) as {
    createFileBackedFedosDesktopSettingsController: FedosElectronSettingsModule["createFileBackedFedosDesktopSettingsController"];
  };
  const bridgeMod = (await import(pathToFileURL(fedosElectronSettingsHostBridgeCompiledPath(packageDir)).href)) as {
    createFedosDesktopSettingsHostBridge: FedosElectronSettingsModule["createFedosDesktopSettingsHostBridge"];
  };
  return {
    createFileBackedFedosDesktopSettingsController: controllerMod.createFileBackedFedosDesktopSettingsController,
    createFedosDesktopSettingsHostBridge: bridgeMod.createFedosDesktopSettingsHostBridge,
  };
}

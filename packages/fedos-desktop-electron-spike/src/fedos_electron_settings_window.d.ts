/**
 * Secure Runtime Alpha 4901-4980 — settings adapter type definitions
 * (Phase G).
 *
 * Global ambient declaration only (no top-level import/export — merges into
 * the real DOM `Window`). Describes the ONE frozen API the preload
 * (`fedos_electron_settings_preload.cts`) exposes via
 * `contextBridge.exposeInMainWorld` — a single `invoke()` method,
 * structurally identical to `ipcRenderer.invoke()`'s request/response shape
 * but never `ipcRenderer` itself. No other method, no business API, no
 * filesystem, no `require`.
 */

interface FedosElectronSettingsApi {
  readonly invoke: (request: unknown) => Promise<unknown>;
}

interface Window {
  readonly fedosSettings: Readonly<FedosElectronSettingsApi>;
}

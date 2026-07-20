/**
 * Secure Runtime Alpha 4101-4180 -- adapter type definitions (Phase C).
 *
 * Global ambient declaration only (no top-level import/export -- merges
 * directly into the real DOM `Window` interface). Describes the ONE
 * frozen API the preload (`fedos_electron_host_adapter_preload.cts`)
 * exposes via `contextBridge.exposeInMainWorld` -- a single `invoke()`
 * method, structurally identical to `ipcRenderer.invoke()`'s own request/
 * response shape but never `ipcRenderer` itself. No other method, no
 * business API, no filesystem, no `require`.
 */

interface FedosElectronHostAdapterApi {
  readonly invoke: (request: unknown) => Promise<unknown>;
}

interface Window {
  readonly fedos: Readonly<FedosElectronHostAdapterApi>;
}

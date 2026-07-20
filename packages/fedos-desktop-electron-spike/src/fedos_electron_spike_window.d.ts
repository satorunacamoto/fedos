/**
 * Secure Runtime Alpha 3881-3940 -- spike type definitions (Phase C/E).
 *
 * Global ambient declaration only (no top-level import/export -- deliberate,
 * so this merges directly into the real DOM `Window` interface rather than
 * requiring a `declare global` wrapper). Describes the ONE, frozen,
 * immutable value the preload (`fedos_electron_spike_preload.cts`) exposes
 * via `contextBridge.exposeInMainWorld` -- build/version metadata only, per
 * this Arc's own Phase E instruction ("at most expose immutable build/
 * version metadata through a fixed method or value"). No method, no
 * business API, no filesystem, no `ipcRenderer`, no `require`.
 */

interface FedosElectronSpikeBuildMetadata {
  readonly electronVersion: string;
  readonly chromeVersion: string;
  readonly nodeVersion: string;
}

interface Window {
  readonly fedosElectronSpikeBuildMetadata: Readonly<FedosElectronSpikeBuildMetadata>;
}

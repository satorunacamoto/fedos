/**
 * Secure Runtime Alpha 4101-4180 -- Electron preload (Phase C).
 *
 * `contextIsolation: true` (mandatory, mirrors the spike's own already-
 * proven-safe configuration) means the page has NO access to any Node/
 * Electron API at all unless a preload explicitly, narrowly bridges one.
 * This preload exposes EXACTLY one frozen API, `window.fedos.invoke()` --
 * no other global, no `ipcRenderer` object itself, no `require`, no
 * filesystem, no business method beyond this one generic transport call.
 *
 * `invoke()` is a THIN forward to `ipcRenderer.invoke("fedos:invoke", request)`
 * -- it does not validate, shape, or interpret `request`/the response in
 * any way (Main's own `fedos_electron_host_adapter_dispatch_translation.ts`
 * and `FedosDesktopHostBridge` itself already do all of that); this file
 * adds no business logic of any kind.
 *
 * `.cts` (not `.ts`): mirrors the spike's own preload exactly -- Electron's
 * sandboxed preload context does not support ESM `import` in the version
 * this Arc verified against, and the root project is `"type": "module"`.
 */

import { contextBridge, ipcRenderer } from "electron";

const fedosApi: FedosElectronHostAdapterApi = Object.freeze({
  invoke: (request: unknown): Promise<unknown> => ipcRenderer.invoke("fedos:invoke", request),
});

contextBridge.exposeInMainWorld("fedos", fedosApi);

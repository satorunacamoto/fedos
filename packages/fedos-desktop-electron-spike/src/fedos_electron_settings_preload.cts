/**
 * Secure Runtime Alpha 4901-4980 — Electron settings preload (Phase G).
 *
 * `contextIsolation: true` means the page has NO access to any Node/Electron
 * API unless a preload explicitly, narrowly bridges one. This preload
 * exposes EXACTLY one frozen API, `window.fedosSettings.invoke()` — no other
 * global, no `ipcRenderer` object itself, no `require`, no filesystem, no
 * business method beyond this one generic transport call. The renderer NEVER
 * touches a Node API directly (Phase G: "Renderer must not directly access
 * Node APIs").
 *
 * `invoke()` is a THIN forward to `ipcRenderer.invoke("fedos-settings:invoke",
 * request)` — it does not validate, shape, or interpret `request`/the
 * response (Main's dispatch translation and the settings host bridge already
 * do all of that); this file adds no business logic.
 *
 * `.cts` (not `.ts`): mirrors every prior preload here exactly — Electron's
 * sandboxed preload context does not support ESM `import` in the verified
 * version, and the root project is `"type": "module"`.
 */

import { contextBridge, ipcRenderer } from "electron";

const fedosSettingsApi: FedosElectronSettingsApi = Object.freeze({
  invoke: (request: unknown): Promise<unknown> => ipcRenderer.invoke("fedos-settings:invoke", request),
});

contextBridge.exposeInMainWorld("fedosSettings", fedosSettingsApi);

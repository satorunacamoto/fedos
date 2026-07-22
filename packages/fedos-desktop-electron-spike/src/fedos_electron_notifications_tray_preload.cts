/**
 * Secure Runtime Alpha 4261-4340 — Phase E: Electron preload.
 *
 * `contextIsolation: true` (mandatory, matches every other preload in this
 * package). Exposes exactly ONE object, `fedosBackground`, whose every
 * member is a thin `ipcRenderer.invoke()` wrapper around one of the
 * channels `fedos_electron_notifications_tray_main.cts` registers — no
 * filesystem, no `require`, no raw `ipcRenderer` reference, no channel
 * beyond the closed, named set below.
 */

import { contextBridge, ipcRenderer } from "electron";

const fedosBackground: FedosBackgroundBridge = Object.freeze({
  status: () => ipcRenderer.invoke("fedos-bg:status"),
  notify: (request: unknown) => ipcRenderer.invoke("fedos-bg:notify", request),
  trayAction: (request: unknown) => ipcRenderer.invoke("fedos-bg:tray-action", request),
  newWindow: () => ipcRenderer.invoke("fedos-bg:new-window"),
  closeThisWindow: () => ipcRenderer.invoke("fedos-bg:close-window"),
  sessionRender: () => ipcRenderer.invoke("fedos-bg:session-render"),
  shutdown: () => ipcRenderer.invoke("fedos-bg:shutdown"),
});

contextBridge.exposeInMainWorld("fedosBackground", fedosBackground);

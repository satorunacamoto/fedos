/**
 * Secure Runtime Alpha 4341-4420 — Phase E: Electron preload.
 *
 * `contextIsolation: true` (mandatory, matches every other preload in this
 * package). Exposes exactly ONE object, `fedosBadge`, whose every member is
 * a thin `ipcRenderer.invoke()` wrapper around one of the nine channels
 * `fedos_electron_badge_main.cts` registers — no filesystem, no `require`,
 * no raw `ipcRenderer` reference, no channel beyond the closed, named set
 * below.
 */

import { contextBridge, ipcRenderer } from "electron";

const fedosBadge: FedosBadgeBridge = Object.freeze({
  bgStatus: () => ipcRenderer.invoke("fedos-badge:bg-status"),
  notify: (request: unknown) => ipcRenderer.invoke("fedos-badge:notify", request),
  trayAction: (request: unknown) => ipcRenderer.invoke("fedos-badge:tray-action", request),
  newWindow: () => ipcRenderer.invoke("fedos-badge:new-window"),
  closeThisWindow: () => ipcRenderer.invoke("fedos-badge:close-window"),
  sessionRender: () => ipcRenderer.invoke("fedos-badge:session-render"),
  shutdown: () => ipcRenderer.invoke("fedos-badge:shutdown"),
  badgeStatus: () => ipcRenderer.invoke("fedos-badge:badge-status"),
  markViewed: (request: unknown) => ipcRenderer.invoke("fedos-badge:mark-viewed", request),
});

contextBridge.exposeInMainWorld("fedosBadge", fedosBadge);

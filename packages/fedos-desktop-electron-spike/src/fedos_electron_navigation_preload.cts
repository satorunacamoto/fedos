/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase E: Electron preload.
 *
 * `contextIsolation: true` (mandatory, matches `fedos_electron_spike_preload.cts`'s
 * own established baseline) means the page has NO access to Node/Electron
 * APIs unless this preload explicitly, narrowly bridges one. Exposes
 * exactly ONE object, `fedosNavigation`, whose every member is a thin
 * `ipcRenderer.invoke()` wrapper around one of the channels
 * `fedos_electron_navigation_main.cts` registers — no filesystem, no
 * `require`, no raw `ipcRenderer` reference, no channel beyond the
 * closed, named set below.
 */

import { contextBridge, ipcRenderer } from "electron";

const fedosNavigation: FedosNavigationBridge = Object.freeze({
  listConversations: () => ipcRenderer.invoke("fedos-nav:list-conversations"),
  openConversation: (conversationId: string) => ipcRenderer.invoke("fedos-nav:open", conversationId),
  switchConversation: (conversationId: string) => ipcRenderer.invoke("fedos-nav:switch", conversationId),
  closeConversation: () => ipcRenderer.invoke("fedos-nav:close"),
  back: () => ipcRenderer.invoke("fedos-nav:back"),
  forward: () => ipcRenderer.invoke("fedos-nav:forward"),
  pinConversation: (conversationId: string) => ipcRenderer.invoke("fedos-nav:pin", conversationId),
  unpinConversation: (conversationId: string) => ipcRenderer.invoke("fedos-nav:unpin", conversationId),
  sessionState: () => ipcRenderer.invoke("fedos-nav:session-state"),
  newWindow: () => ipcRenderer.invoke("fedos-nav:new-window"),
});

contextBridge.exposeInMainWorld("fedosNavigation", fedosNavigation);

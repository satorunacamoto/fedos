/**
 * Secure Runtime Alpha 5061-5160 — the Beta preload.
 *
 * `contextIsolation: true` / `sandbox: true` (mandatory, matches every other
 * preload in this package). Exposes exactly TWO frozen objects:
 *   - `fedosProfile` — the SAME closed shape as `fedos_electron_unlock_preload.cts`
 *     exposes, over the SAME `fedos-profile:*` channels (Phase P reuse).
 *   - `fedosBeta` — status + settings-application only, over the closed,
 *     additive `fedos-beta:*` channel set `fedos_electron_beta_main.cts`
 *     registers.
 *
 * No generic `invoke(channel, any)`, no `ipcRenderer`, no `require`, no
 * `fs`/`process`/`Buffer`/`crypto`/WASM exposure.
 */

import { contextBridge, ipcRenderer } from "electron";

const MAX_PASSPHRASE_CHARS = 4096;
const MAX_LABEL_CHARS = 256;
/** Secure Runtime Alpha 7001-7080 — mirrors `MAX_LABEL_CHARS` above; sized for an id/conversationId/deviceId, never a secret. */
const MAX_ID_CHARS = 512;
const MAX_MESSAGE_BODY_CHARS = 8192;
const MAX_PAIRING_ENVELOPE_CHARS = 8192;

function boundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const fedosProfile: FedosProfileBridge = Object.freeze({
  status: () => ipcRenderer.invoke("fedos-profile:status"),
  create: (label: string, passphrase: string) =>
    ipcRenderer.invoke("fedos-profile:create", {
      label: boundedString(label, MAX_LABEL_CHARS),
      secret: boundedString(passphrase, MAX_PASSPHRASE_CHARS),
    }),
  unlock: (passphrase: string) =>
    ipcRenderer.invoke("fedos-profile:unlock", { secret: boundedString(passphrase, MAX_PASSPHRASE_CHARS) }),
  lock: () => ipcRenderer.invoke("fedos-profile:lock"),
  quit: () => ipcRenderer.invoke("fedos-profile:quit"),
});

const fedosBeta: FedosBetaBridge = Object.freeze({
  status: () => ipcRenderer.invoke("fedos-beta:status"),
  settingsPlan: (candidate: unknown) => ipcRenderer.invoke("fedos-beta:settings-plan", candidate),
  settingsApply: (candidate: unknown) => ipcRenderer.invoke("fedos-beta:settings-apply", candidate),
});

const fedosAcceptance: FedosAcceptanceBridge = Object.freeze({
  createDirectConversation: (recipient: { readonly authority: string; readonly publicIdentifier: string }) =>
    ipcRenderer.invoke("fedos-acceptance:create-direct-conversation", {
      recipient: { authority: boundedString(recipient?.authority, MAX_ID_CHARS), publicIdentifier: boundedString(recipient?.publicIdentifier, MAX_ID_CHARS) },
    }),
  activateDirectConversation: (conversationId: string) =>
    ipcRenderer.invoke("fedos-acceptance:activate-direct-conversation", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) =>
    ipcRenderer.invoke("fedos-acceptance:device-pairing-create", { deviceId: boundedString(deviceId, MAX_ID_CHARS), expectedAccountRef }),
  devicePairingInspect: (encodedRequest: string) =>
    ipcRenderer.invoke("fedos-acceptance:device-pairing-inspect", { encodedRequest: boundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS) }),
  devicePairingApprove: (encodedRequest: string) =>
    ipcRenderer.invoke("fedos-acceptance:device-pairing-approve", { encodedRequest: boundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS) }),
  devicePairingComplete: (pairingId: string, encodedApproval: string) =>
    ipcRenderer.invoke("fedos-acceptance:device-pairing-complete", {
      pairingId: boundedString(pairingId, MAX_ID_CHARS),
      encodedApproval: boundedString(encodedApproval, MAX_PAIRING_ENVELOPE_CHARS),
    }),
  establishDirectRatchetSession: (conversationId: string, remoteDeviceRef: string) =>
    ipcRenderer.invoke("fedos-acceptance:establish-direct-ratchet-session", {
      conversationId: boundedString(conversationId, MAX_ID_CHARS),
      remoteDeviceRef: boundedString(remoteDeviceRef, MAX_ID_CHARS),
    }),
  sendMessage: (conversationId: string, sender: unknown, body: string) =>
    ipcRenderer.invoke("fedos-acceptance:send-message", {
      conversationId: boundedString(conversationId, MAX_ID_CHARS),
      sender,
      body: boundedString(body, MAX_MESSAGE_BODY_CHARS),
    }),
  listMessages: (conversationId: string) => ipcRenderer.invoke("fedos-acceptance:list-messages", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  readMessage: (conversationId: string, messageId: string) =>
    ipcRenderer.invoke("fedos-acceptance:read-message", { conversationId: boundedString(conversationId, MAX_ID_CHARS), messageId: boundedString(messageId, MAX_ID_CHARS) }),
  directRatchetStatus: (conversationId: string, remoteDeviceRef: string) =>
    ipcRenderer.invoke("fedos-acceptance:direct-ratchet-status", {
      conversationId: boundedString(conversationId, MAX_ID_CHARS),
      remoteDeviceRef: boundedString(remoteDeviceRef, MAX_ID_CHARS),
    }),
});

contextBridge.exposeInMainWorld("fedosProfile", fedosProfile);
contextBridge.exposeInMainWorld("fedosBeta", fedosBeta);
contextBridge.exposeInMainWorld("fedosAcceptance", fedosAcceptance);

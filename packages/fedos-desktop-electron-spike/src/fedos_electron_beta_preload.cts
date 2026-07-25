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
/** Secure Runtime Alpha 7321-7400 — mirrors `MAX_LABEL_CHARS` above; sized for a Search query, never a document body. */
const MAX_SEARCH_QUERY_CHARS = 256;
/** Secure Runtime Alpha 7321-7400 — a real filesystem path for Archive export/import. */
const MAX_ARCHIVE_PATH_CHARS = 4096;

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
  createConversationInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) =>
    ipcRenderer.invoke("fedos-acceptance:create-conversation-invitation", {
      invitee: { authority: boundedString(invitee?.authority, MAX_ID_CHARS), publicIdentifier: boundedString(invitee?.publicIdentifier, MAX_ID_CHARS) },
      expiresInMs: typeof expiresInMs === "number" ? expiresInMs : undefined,
    }),
  search: (query: string) => ipcRenderer.invoke("fedos-acceptance:search", { query: boundedString(query, MAX_SEARCH_QUERY_CHARS) }),
  archive: (command: unknown) => {
    const op = (command as { operation?: unknown } | null)?.operation;
    if (op === "inspect") {
      return ipcRenderer.invoke("fedos-acceptance:archive", { operation: "inspect", sourcePath: boundedString((command as { sourcePath?: unknown }).sourcePath, MAX_ARCHIVE_PATH_CHARS) });
    }
    return ipcRenderer.invoke("fedos-acceptance:archive", { operation: op, request: (command as { request?: unknown } | null)?.request });
  },
  safetyCenterOverview: () => ipcRenderer.invoke("fedos-acceptance:safety-center-overview"),
});

/**
 * Secure Runtime Alpha 8041-8120 — the ORDINARY, user-facing bridge. Every
 * method below is a validated, single-purpose `ipcRenderer.invoke()` call
 * over its own named `fedos-app:*` channel (the SAME discipline as
 * `fedosAcceptance` above — never a generic `invoke(channel, any)`, never a
 * raw filesystem path where a picker exists). This is the ONLY bridge the
 * ordinary page (`fedos_electron_beta_renderer.ts`) may call for
 * Conversations/Search/Archive/Devices/Identity Replacement/Signed
 * Deletion/Safety Center/Settings — `fedosAcceptance` remains reachable only
 * by the pre-existing acceptance-mode test harness (Phase Q).
 */
const fedosApp: FedosAppBridge = Object.freeze({
  conversationsList: () => ipcRenderer.invoke("fedos-app:conversations-list"),
  conversationOpen: (conversationId: string) => ipcRenderer.invoke("fedos-app:conversation-open", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  conversationActivate: (conversationId: string) => ipcRenderer.invoke("fedos-app:conversation-activate", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  messagesList: (conversationId: string) => ipcRenderer.invoke("fedos-app:messages-list", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  messageReveal: (messageId: string) => ipcRenderer.invoke("fedos-app:message-reveal", { messageId: boundedString(messageId, MAX_ID_CHARS) }),
  messageSend: (conversationId: string, body: string) =>
    ipcRenderer.invoke("fedos-app:message-send", { conversationId: boundedString(conversationId, MAX_ID_CHARS), body: boundedString(body, MAX_MESSAGE_BODY_CHARS) }),
  membershipList: (conversationId: string) => ipcRenderer.invoke("fedos-app:membership-list", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  invitationsList: (conversationId: string) => ipcRenderer.invoke("fedos-app:invitations-list", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  createInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) =>
    ipcRenderer.invoke("fedos-app:create-invitation", {
      invitee: { authority: boundedString(invitee?.authority, MAX_ID_CHARS), publicIdentifier: boundedString(invitee?.publicIdentifier, MAX_ID_CHARS) },
      expiresInMs: typeof expiresInMs === "number" ? expiresInMs : undefined,
    }),
  search: (query: string) => ipcRenderer.invoke("fedos-app:search", { query: boundedString(query, MAX_SEARCH_QUERY_CHARS) }),
  archiveInspect: (sourcePath: string) => ipcRenderer.invoke("fedos-app:archive", { operation: "inspect", sourcePath: boundedString(sourcePath, MAX_ARCHIVE_PATH_CHARS) }),
  archiveExport: (request: unknown) => ipcRenderer.invoke("fedos-app:archive", { operation: "export", request }),
  archivePreflightRestore: (request: unknown) => ipcRenderer.invoke("fedos-app:archive", { operation: "preflightRestore", request }),
  archiveRestore: (request: unknown) => ipcRenderer.invoke("fedos-app:archive", { operation: "restore", request }),
  archiveWorkflowWarnings: (operation: "inspect" | "preflightRestore" | "export" | "restore") => ipcRenderer.invoke("fedos-app:archive-workflow-warnings", { operation }),
  archiveChooseExportDestination: (conversationId: string) => ipcRenderer.invoke("fedos-app:archive-choose-export-destination", { conversationId: boundedString(conversationId, MAX_ID_CHARS) }),
  archiveChooseSource: () => ipcRenderer.invoke("fedos-app:archive-choose-source"),
  devicesList: () => ipcRenderer.invoke("fedos-app:devices-list"),
  deviceDetail: (deviceId: string) => ipcRenderer.invoke("fedos-app:device-detail", { deviceId: boundedString(deviceId, MAX_ID_CHARS) }),
  deviceRevoke: (deviceId: string, devicePublicKeyHex: string) =>
    ipcRenderer.invoke("fedos-app:device-revoke", { deviceId: boundedString(deviceId, MAX_ID_CHARS), devicePublicKeyHex: boundedString(devicePublicKeyHex, MAX_ID_CHARS) }),
  deviceSyncStatus: () => ipcRenderer.invoke("fedos-app:device-sync-status"),
  devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) =>
    ipcRenderer.invoke("fedos-app:device-pairing-create", { deviceId: boundedString(deviceId, MAX_ID_CHARS), expectedAccountRef }),
  devicePairingInspect: (encodedRequest: string) => ipcRenderer.invoke("fedos-app:device-pairing-inspect", { encodedRequest: boundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS) }),
  devicePairingApprove: (encodedRequest: string) => ipcRenderer.invoke("fedos-app:device-pairing-approve", { encodedRequest: boundedString(encodedRequest, MAX_PAIRING_ENVELOPE_CHARS) }),
  devicePairingComplete: (pairingId: string, encodedApproval: string) =>
    ipcRenderer.invoke("fedos-app:device-pairing-complete", { pairingId: boundedString(pairingId, MAX_ID_CHARS), encodedApproval: boundedString(encodedApproval, MAX_PAIRING_ENVELOPE_CHARS) }),
  identityTransitionList: (limit?: number, offset?: number) =>
    ipcRenderer.invoke("fedos-app:identity-transition-list", { limit: typeof limit === "number" ? limit : undefined, offset: typeof offset === "number" ? offset : undefined }),
  identityTransitionOpen: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-open", { peerAccountRef, peerDeviceRef: boundedString(peerDeviceRef, MAX_ID_CHARS), transitionId: boundedString(transitionId, MAX_ID_CHARS) }),
  identityTransitionAccept: () => ipcRenderer.invoke("fedos-app:identity-transition-accept"),
  identityTransitionReject: () => ipcRenderer.invoke("fedos-app:identity-transition-reject"),
  identityTransitionDefer: () => ipcRenderer.invoke("fedos-app:identity-transition-defer"),
  identityTransitionRecordManualVerification: (method: string, noteCode: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-record-manual-verification", { method: boundedString(method, MAX_LABEL_CHARS), noteCode: boundedString(noteCode, MAX_LABEL_CHARS) }),
  deletionRequestListReceived: () => ipcRenderer.invoke("fedos-app:deletion-request-list-received"),
  deletionRequestOpen: (requestId: string) => ipcRenderer.invoke("fedos-app:deletion-request-open", { requestId: boundedString(requestId, MAX_ID_CHARS) }),
  deletionRequestApprove: () => ipcRenderer.invoke("fedos-app:deletion-request-approve"),
  deletionRequestReject: () => ipcRenderer.invoke("fedos-app:deletion-request-reject"),
  safetyCenterOverview: () => ipcRenderer.invoke("fedos-app:safety-center-overview"),
  settingsLoad: () => ipcRenderer.invoke("fedos-app:settings-load"),
});

contextBridge.exposeInMainWorld("fedosProfile", fedosProfile);
contextBridge.exposeInMainWorld("fedosBeta", fedosBeta);
contextBridge.exposeInMainWorld("fedosAcceptance", fedosAcceptance);
contextBridge.exposeInMainWorld("fedosApp", fedosApp);

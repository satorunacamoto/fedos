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

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (external audit
 * delta `6873d24f`): mirrors `fedos_electron_beta_main.cts`'s own
 * `ACCEPTANCE_MODE_ENABLED` gate exactly (same closed literal check,
 * same env var), independently re-derived here rather than passed in —
 * two separate enforcement points (this file's own `exposeInMainWorld`
 * call below, and main's own `ipcMain.handle` registration), neither
 * depending on the other. Preload runs in a privileged context with its
 * own `process.env` snapshot even under `sandbox: true` (confirmed: this
 * package's OTHER preload files already read `process.versions` the same
 * way) — the Renderer's own isolated-world JS can never read or
 * influence this value.
 */
const ACCEPTANCE_MODE_ENABLED = process.env.FEDOS_ELECTRON_BETA_AUTOTEST === "acceptance";

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
/** Commerce E2E Completion arc — mirrors `fedos_electron_beta_main.cts`'s own identical constants exactly (bounds are enforced independently on both sides of the IPC boundary, same discipline as every other bound in this file). */
const MAX_PRODUCT_TITLE_CHARS = 200;
const MAX_PRODUCT_DESCRIPTION_CHARS = 4000;
const MAX_CURRENCY_CHARS = 8;
const MAX_ORDER_REJECTION_REASON_CHARS = 500;
/** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- mirrors `fedos_electron_beta_main.cts`'s own identical constants exactly (bounds are enforced independently on both sides of the IPC boundary, same discipline as every other bound in this file). */
const MAX_PRODUCT_IMAGE_BASE64_CHARS = 12_000_000;
const MAX_PRODUCT_IMAGE_ALT_TEXT_CHARS = 300;
const MAX_PRODUCT_IMAGE_CONTENT_TYPE_CHARS = 64;

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
  // Secure Runtime Alpha 8121-8200 -- Security Finding 3: the exact id
  // tuple travels WITH the decision, never an implicit "currently
  // selected" server-side reference.
  identityTransitionAccept: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-accept", { peerAccountRef, peerDeviceRef: boundedString(peerDeviceRef, MAX_ID_CHARS), transitionId: boundedString(transitionId, MAX_ID_CHARS) }),
  identityTransitionReject: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-reject", { peerAccountRef, peerDeviceRef: boundedString(peerDeviceRef, MAX_ID_CHARS), transitionId: boundedString(transitionId, MAX_ID_CHARS) }),
  identityTransitionDefer: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-defer", { peerAccountRef, peerDeviceRef: boundedString(peerDeviceRef, MAX_ID_CHARS), transitionId: boundedString(transitionId, MAX_ID_CHARS) }),
  identityTransitionRecordManualVerification: (method: string, noteCode: string) =>
    ipcRenderer.invoke("fedos-app:identity-transition-record-manual-verification", { method: boundedString(method, MAX_LABEL_CHARS), noteCode: boundedString(noteCode, MAX_LABEL_CHARS) }),
  deletionRequestListReceived: () => ipcRenderer.invoke("fedos-app:deletion-request-list-received"),
  deletionRequestOpen: (requestId: string) => ipcRenderer.invoke("fedos-app:deletion-request-open", { requestId: boundedString(requestId, MAX_ID_CHARS) }),
  // Secure Runtime Alpha 8121-8200 -- Security Finding 3: exact requestId travels with the decision.
  deletionRequestApprove: (requestId: string) => ipcRenderer.invoke("fedos-app:deletion-request-approve", { requestId: boundedString(requestId, MAX_ID_CHARS) }),
  deletionRequestReject: (requestId: string) => ipcRenderer.invoke("fedos-app:deletion-request-reject", { requestId: boundedString(requestId, MAX_ID_CHARS) }),
  safetyCenterOverview: () => ipcRenderer.invoke("fedos-app:safety-center-overview"),
  settingsLoad: () => ipcRenderer.invoke("fedos-app:settings-load"),
  relayStatus: () => ipcRenderer.invoke("fedos-app:relay-status"),
  // Commerce Reachable Catalog + Product Surface Phase 1 -- read-only,
  // same bounded-string discipline as every method above.
  commerceCatalogList: () => ipcRenderer.invoke("fedos-app:commerce-catalog-list"),
  commerceProductDetail: (productId: string) => ipcRenderer.invoke("fedos-app:commerce-product-detail", { productId: boundedString(productId, MAX_ID_CHARS) }),
  // Commerce E2E Completion arc (coordinator integration gate) -- Merchant
  // Product CRUD + Order + local Payment simulator. SAME bounded-string
  // discipline as every method above; no method here accepts a raw
  // "mark as paid" flag, an order status string, or a payment-evidence
  // shape from the renderer -- `commercePaymentSimulate` sends only
  // `orderId`/`paymentId`, main process alone decides evidence and status.
  commerceMerchantProductsList: (actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-merchant-products-list", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceProductCreate: (actorPubkey: string, input: { title: string; description?: string; priceCents: number; currency: string }) =>
    ipcRenderer.invoke("fedos-app:commerce-product-create", {
      actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS),
      title: boundedString(input?.title, MAX_PRODUCT_TITLE_CHARS),
      description: input?.description === undefined ? undefined : boundedString(input.description, MAX_PRODUCT_DESCRIPTION_CHARS),
      priceCents: typeof input?.priceCents === "number" ? input.priceCents : -1,
      currency: boundedString(input?.currency, MAX_CURRENCY_CHARS),
    }),
  commerceProductUpdate: (actorPubkey: string, productId: string, patch: { title?: string; description?: string; priceCents?: number; currency?: string }) =>
    ipcRenderer.invoke("fedos-app:commerce-product-update", {
      actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS),
      productId: boundedString(productId, MAX_ID_CHARS),
      title: patch?.title === undefined ? undefined : boundedString(patch.title, MAX_PRODUCT_TITLE_CHARS),
      description: patch?.description === undefined ? undefined : boundedString(patch.description, MAX_PRODUCT_DESCRIPTION_CHARS),
      priceCents: patch?.priceCents,
      currency: patch?.currency === undefined ? undefined : boundedString(patch.currency, MAX_CURRENCY_CHARS),
    }),
  commerceProductPublish: (actorPubkey: string, productId: string) =>
    ipcRenderer.invoke("fedos-app:commerce-product-publish", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS), productId: boundedString(productId, MAX_ID_CHARS) }),
  commerceProductUnpublish: (actorPubkey: string, productId: string) =>
    ipcRenderer.invoke("fedos-app:commerce-product-unpublish", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS), productId: boundedString(productId, MAX_ID_CHARS) }),
  commerceOrderCreate: (buyerPubkey: string, productId: string, quantity?: number) =>
    ipcRenderer.invoke("fedos-app:commerce-order-create", {
      buyerPubkey: boundedString(buyerPubkey, MAX_ID_CHARS),
      productId: boundedString(productId, MAX_ID_CHARS),
      quantity: typeof quantity === "number" ? quantity : undefined,
    }),
  commerceOrderSubmit: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-submit", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrderCancel: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-cancel", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrderAccept: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-accept", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrderReject: (orderId: string, actorPubkey: string, reason?: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-reject", {
      orderId: boundedString(orderId, MAX_ID_CHARS),
      actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS),
      reason: reason === undefined ? undefined : boundedString(reason, MAX_ORDER_REJECTION_REASON_CHARS),
    }),
  commerceOrderFulfill: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-fulfill", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrdersListMine: (actorPubkey: string) => ipcRenderer.invoke("fedos-app:commerce-orders-list-mine", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrdersListIncoming: (actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-orders-list-incoming", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commercePaymentRequest: (orderId: string) => ipcRenderer.invoke("fedos-app:commerce-payment-request", { orderId: boundedString(orderId, MAX_ID_CHARS) }),
  commercePaymentSimulate: (orderId: string, paymentId: string) =>
    ipcRenderer.invoke("fedos-app:commerce-payment-simulate", { orderId: boundedString(orderId, MAX_ID_CHARS), paymentId: boundedString(paymentId, MAX_ID_CHARS) }),
  commerceDeliveryStatus: (orderId: string) => ipcRenderer.invoke("fedos-app:commerce-delivery-status", { orderId: boundedString(orderId, MAX_ID_CHARS) }),
  commerceDeliveryAcknowledgeReceipt: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-delivery-acknowledge-receipt", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceOrderComplete: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-order-complete", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceReceiptIssue: (orderId: string) => ipcRenderer.invoke("fedos-app:commerce-receipt-issue", { orderId: boundedString(orderId, MAX_ID_CHARS) }),
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's
  // read-only Persona Board query. Same bounded-string discipline as every
  // method above; the renderer never selects a disclosure layer -- the
  // main process always queries "PUBLIC" (see `handleCommercePersonaBoardQuery`).
  commercePersonaBoardQuery: (subjectPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-persona-board-query", { subjectPubkey: boundedString(subjectPubkey, MAX_ID_CHARS) }),
  // FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's
  // minimal NetworkProfile Settings surface (view/select only -- no
  // arbitrary string reaches main; `commerceNetworkProfileSet` sends only
  // one of the three real `NetworkProfile` literal values).
  commerceNetworkProfileGet: () => ipcRenderer.invoke("fedos-app:commerce-network-profile-get"),
  commerceNetworkProfileSet: (profile: "local-only" | "direct" | "tor-optional") =>
    ipcRenderer.invoke("fedos-app:commerce-network-profile-set", { profile }),
  // FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
  // (Agent D) -- product-image attach (arc §38), protected-media redeem
  // (arc §35-37), and the real activity/badge data query (arc §32/§36).
  // Same bounded-string discipline as every method above; image bytes
  // travel as base64 text over IPC (Electron's structured-clone channel
  // does not efficiently support raw `ArrayBuffer`/`Uint8Array` transfer
  // in this codebase's existing IPC convention -- every other binary-ish
  // payload in this file, e.g. Device-pairing envelopes, is also a
  // bounded string, not a raw buffer).
  commerceProductImageAttach: (actorPubkey: string, productId: string, imageBase64: string, contentType: string, altText?: string) =>
    ipcRenderer.invoke("fedos-app:commerce-product-image-attach", {
      actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS),
      productId: boundedString(productId, MAX_ID_CHARS),
      imageBase64: boundedString(imageBase64, MAX_PRODUCT_IMAGE_BASE64_CHARS),
      contentType: boundedString(contentType, MAX_PRODUCT_IMAGE_CONTENT_TYPE_CHARS),
      altText: altText === undefined ? undefined : boundedString(altText, MAX_PRODUCT_IMAGE_ALT_TEXT_CHARS),
    }),
  commerceMediaGrantRedeem: (orderId: string, actorPubkey: string) =>
    ipcRenderer.invoke("fedos-app:commerce-media-grant-redeem", { orderId: boundedString(orderId, MAX_ID_CHARS), actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
  commerceActivitySummary: (actorPubkey: string) => ipcRenderer.invoke("fedos-app:commerce-activity-summary", { actorPubkey: boundedString(actorPubkey, MAX_ID_CHARS) }),
});

contextBridge.exposeInMainWorld("fedosProfile", fedosProfile);
contextBridge.exposeInMainWorld("fedosBeta", fedosBeta);
// Secure Runtime Alpha 8121-8200 -- Security Finding 1: only exposed into
// the Renderer's isolated world when explicit acceptance mode is active
// (see `ACCEPTANCE_MODE_ENABLED` above). An ordinary packaged production
// launch (or any other AUTOTEST_MODE value) never defines
// `window.fedosAcceptance` at all -- not merely unused by the page, but
// genuinely absent from `window`.
if (ACCEPTANCE_MODE_ENABLED) {
  contextBridge.exposeInMainWorld("fedosAcceptance", fedosAcceptance);
}
contextBridge.exposeInMainWorld("fedosApp", fedosApp);

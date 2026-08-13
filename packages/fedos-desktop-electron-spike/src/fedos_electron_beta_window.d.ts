/**
 * Secure Runtime Alpha 5061-5160 — window type definitions (global ambient
 * declaration only). Describes the TWO values `fedos_electron_beta_preload.cts`
 * exposes via `contextBridge.exposeInMainWorld`.
 *
 * `FedosProfileBridge` mirrors `fedos_electron_unlock_window.d.ts` exactly
 * (Phase P reuse — same shape, same channels underneath).
 */

interface FedosProfileStatusResult {
  readonly presence: string;
  readonly lifecycleState: string;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
}

interface FedosProfileCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly ready?: {
    readonly displayLabel: string;
    readonly accountPublicIdentifier: string;
    readonly localDeviceId: string;
    readonly deviceTrustState: string;
  };
}

interface FedosProfileBridge {
  readonly status: () => Promise<FedosProfileStatusResult>;
  readonly create: (label: string, passphrase: string) => Promise<FedosProfileCommandResult>;
  readonly unlock: (passphrase: string) => Promise<FedosProfileCommandResult>;
  readonly lock: () => Promise<FedosProfileCommandResult>;
  readonly quit: () => Promise<{ readonly ok: boolean }>;
}

/** The Phase H Beta Home status surface — real, non-secret facts only (see `fedos_desktop_beta_*` value objects, `src/desktop/beta/`). */
interface FedosBetaStatusResult {
  readonly profile: FedosProfileStatusResult;
  readonly settingsEffectiveState: unknown;
  readonly capabilities: unknown;
  readonly release: unknown;
  readonly limitations: unknown;
}

interface FedosBetaBridge {
  readonly status: () => Promise<FedosBetaStatusResult>;
  readonly settingsPlan: (candidate: unknown) => Promise<unknown>;
  readonly settingsApply: (candidate: unknown) => Promise<unknown>;
  /**
   * Commerce Real Two-Party UX Closure (Agent U) -- a plain, synchronous
   * boolean (never a Promise/IPC round-trip; mirrors this file's own
   * `ACCEPTANCE_MODE_ENABLED` pattern), true whenever
   * `FEDOS_ELECTRON_BETA_AUTOTEST` is set to ANY non-empty value in the main
   * process (create/unlock/acceptance/ui-script -- every existing test mode,
   * never true on an ordinary production launch). The ONLY consumer today is
   * the renderer's own `Current screen: <state>` debug label (Commerce
   * Friction Ledger row 12) -- gated behind this flag rather than deleted,
   * since several real E2E tests read `#current-screen`'s `textContent`
   * directly via `document.querySelector` (unaffected by this flag either
   * way -- only VISIBILITY is gated, the text itself is always kept
   * up to date).
   */
  readonly debugInstrumentationEnabled: boolean;
}

/**
 * Secure Runtime Alpha 7001-7080 — the closed `fedos-acceptance:*` command
 * vocabulary (Phase C); EXTENDED by Secure Runtime Alpha 7321-7400 with
 * `createConversationInvitation`/`search`/`archive`/`safetyCenterOverview`.
 * Every method rejects with `{outcome:"unavailable"}` whenever no real
 * profile is currently unlocked (`fedos_electron_beta_main.cts`'s own
 * `requireShell()`/`requireBoundary()`) — the SAME real precondition every
 * other bridge in this file already requires. Genuinely reachable in
 * ordinary packaged production mode once a real profile is unlocked
 * (Secure Runtime Alpha 7321-7400 closed the prior AUTOTEST-only gate —
 * see `secure_runtime_alpha_7321_7400_structural_guards.test.ts`).
 */
interface FedosAcceptanceCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

interface FedosAcceptanceBridge {
  readonly createDirectConversation: (recipient: { readonly authority: string; readonly publicIdentifier: string }) => Promise<FedosAcceptanceCommandResult>;
  readonly activateDirectConversation: (conversationId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingInspect: (encodedRequest: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingApprove: (encodedRequest: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingComplete: (pairingId: string, encodedApproval: string) => Promise<FedosAcceptanceCommandResult>;
  readonly establishDirectRatchetSession: (conversationId: string, remoteDeviceRef: string) => Promise<FedosAcceptanceCommandResult>;
  readonly sendMessage: (conversationId: string, sender: unknown, body: string) => Promise<FedosAcceptanceCommandResult>;
  readonly listMessages: (conversationId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly readMessage: (conversationId: string, messageId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly directRatchetStatus: (conversationId: string, remoteDeviceRef: string) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-2. */
  readonly createConversationInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Search). */
  readonly search: (query: string) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Archive). */
  readonly archive: (command: unknown) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Safety Center). */
  readonly safetyCenterOverview: () => Promise<FedosAcceptanceCommandResult>;
}

/**
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — the ORDINARY, user-facing command vocabulary. Every
 * method is reachable in ordinary packaged production mode once a real
 * profile is unlocked, gated by the SAME `requireShell()`/`requireBoundary()`
 * precondition every other bridge already uses. This is the ONLY bridge
 * `fedos_electron_beta_renderer.ts` may call for Conversations/Search/
 * Archive/Devices/Identity Replacement/Signed Deletion/Safety Center/
 * Settings — `fedosAcceptance` remains reachable only by the pre-existing
 * acceptance-mode test harness.
 */
interface FedosAppCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — the capacity
 * an actor explicitly asserts for a Commerce action. Mirrors the real
 * `os/commerce` domain's `OrderActorKind`/`CreateProductInput.actorRole`
 * (structurally re-declared here, same discipline as every other
 * `FedosCommerce*` shape in this file — see this file's own header on why
 * this package never `import type`s from `src/os/commerce/**`).
 */
type FedosCommerceActorRole = "customer" | "merchant";

/** Commerce Reachable Catalog + Product Surface Phase 1 — one catalog row.
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * `isDemo` added (arc mandate item 5): `true` for one of the fixed,
 * closed-set demo/tutorial fixtures, `false` for a real (local or
 * genuinely Nostr-discovered) listing. See
 * `fedos_electron_beta_main.cts`'s `handleCommerceCatalogList()` own
 * header for why this stays ONE array (never split into two) -- a
 * pre-existing real Electron E2E test dependency on positional ordering. */
interface FedosCommerceCatalogListItem {
  readonly id: string;
  readonly title: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly merchantLabel: string;
  readonly status: string;
  readonly hasImage: boolean;
  readonly isDemo: boolean;
}

/** FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * mirrors `fedos_electron_beta_main.cts`'s own `CommerceDiscoveryAttemptOutcome`
 * exactly (arc mandate item 2). */
interface FedosCommerceDiscoveryAttempt {
  readonly outcome: "skipped-local-only" | "skipped-no-relay" | "ok" | "failed";
  readonly ingestedCount?: number;
  readonly reason?: string;
}

interface FedosCommerceCatalogListResult {
  readonly outcome: string;
  readonly reason?: string;
  /** Every item, real AND demo -- see `FedosCommerceCatalogListItem.isDemo` and this file's own header. */
  readonly products?: readonly FedosCommerceCatalogListItem[];
  readonly discoveryAttempt?: FedosCommerceDiscoveryAttempt;
  readonly networkProfile?: "local-only" | "direct" | "tor-optional";
  readonly hasConfiguredRelay?: boolean;
  /** Count of `products` entries with `isDemo: false` -- what `noListings` (arc mandate item 2) is derived from. */
  readonly realListingCount?: number;
}

interface FedosCommerceProductMedia {
  readonly dataUri: string;
  readonly mimeType: string;
  readonly altText: string;
}

interface FedosCommerceProductDetail {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly merchantLabel: string;
  readonly status: string;
  readonly media: FedosCommerceProductMedia | null;
  /** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- the seller's real pubkey, used by the renderer's Seller Reputation panel to call `commercePersonaBoardQuery`. */
  readonly creatorPubkey: string;
  /** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- true only when this response came from the creator-only draft/unpublished preview path (friction ledger row #24), never for an ordinary published buyer view. */
  readonly isPreview: boolean;
}

interface FedosCommerceProductDetailResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly product?: FedosCommerceProductDetail;
}

/** Commerce E2E Completion arc — Merchant Product CRUD / Order / local Payment simulator shapes. */
interface FedosCommerceMerchantProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: string;
  readonly visibility: string;
  readonly creatorPubkey: string;
  readonly merchantLabel: string;
}

interface FedosCommerceMerchantProductsListResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly products?: readonly FedosCommerceMerchantProduct[];
}

interface FedosCommerceProductMutationResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly product?: FedosCommerceMerchantProduct;
  /** FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- see `FedosCommerceOrderResult.nostrSyncOutcome`'s own doc comment above; same field, same discipline, set by publish/unpublish/update. */
  readonly nostrSyncOutcome?: string;
}

interface FedosCommerceOrder {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly totalCents: number;
  readonly paymentId: string | null;
  readonly deliveryId: string | null;
}

interface FedosCommerceOrderResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly order?: FedosCommerceOrder;
  /**
   * Commerce Real Two-Party UX Closure (Agent U) -- ONLY ever set by
   * `commerceOrderComplete`'s own result (every other order-action result
   * sharing this interface simply omits it). Truthfully reports whether the
   * secondary, non-fatal reputation-attestation issuance
   * (`issueReputationAttestationsForCompletedOrderNonFatal` in
   * `fedos_electron_beta_main.cts`) actually succeeded for BOTH parties --
   * never silently swallowed (Commerce Friction Ledger row 21, arc §42).
   * The Order itself reaches `"completed"` (this result's own `outcome`)
   * regardless of this field's value -- the core transaction is never
   * blocked by the secondary one failing.
   */
  readonly reputationSyncStatus?: "recorded" | "unavailable";
  /**
   * FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- the main
   * process has computed and returned this field on every order-action
   * result since the prior arc (product publish/update carries the same
   * field on `FedosCommerceProductMutationResult` below), but it was never
   * declared here or read by the renderer -- a real cross-process sync
   * failure (the counterparty was never actually notified) was silently
   * dropped at the UI layer. See `describeCommerceSyncOutcome()`
   * (`src/os/commerce/order/cross_process_outcome_text.ts`) for the honest,
   * closed-vocabulary-with-safe-fallback copy this field is rendered
   * through -- this is an ARBITRARY string in the worst case (a
   * transport-supplied message), never rendered verbatim.
   */
  readonly nostrSyncOutcome?: string;
  /**
   * FedOS Commerce "Purchase Completion" mega-arc (Coordinator, integration
   * phase) -- the SECOND cross-process channel's outcome, distinct from
   * `nostrSyncOutcome` above: Agent P's private `PaymentEvidence`
   * transport, carrying an already-authoritative settlement confirmation
   * from the buyer's process (which owns the payment rail) to the seller's
   * independent process. Set only by `commercePaymentSimulate`; `undefined`
   * on every other order action, meaning "no payment-evidence send was
   * attempted here" -- never "it succeeded".
   *
   * Rendered through the same closed-vocabulary
   * `describeCommerceSyncOutcome()` as `nostrSyncOutcome`, on its own
   * `"payment-evidence"` channel. Carries ONE outcome the order channel
   * never produces: `"evidence-not-transportable"`, the OUTBOUND authority
   * gate refusing to package non-authoritative evidence -- a security
   * refusal that must never be presented as a network failure.
   */
  readonly paymentSyncOutcome?: string;
  /**
   * FedOS Commerce "Purchase Completion" mega-arc (Coordinator, integration
   * phase) -- the THIRD cross-process channel's outcome: Agent D's private
   * Delivery/status transport. Agent D already performed these sends but
   * DISCARDED their results, so a buyer/seller whose delivery update never
   * actually reached the counterparty's process was told nothing. Set by
   * the `"fulfill"` order action and by `commerceOrderComplete` (only when
   * a real local Delivery record closed out alongside the Order);
   * `undefined` otherwise, meaning "no delivery send was attempted here".
   */
  readonly deliverySyncOutcome?: string;
}

interface FedosCommerceOrdersListResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly orders?: readonly FedosCommerceOrder[];
}

interface FedosCommercePaymentRequestResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly paymentId?: string;
  readonly amountCents?: number;
  readonly currency?: string;
}

/** Commerce E2E Completion arc (Wave B integration) — Delivery + Trust/QR receipt shapes. */
interface FedosCommerceDelivery {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
}

interface FedosCommerceDeliveryStatusResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly delivery?: FedosCommerceDelivery;
}

interface FedosCommerceDeliveryAcknowledgeResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly order?: FedosCommerceOrder;
  readonly delivery?: FedosCommerceDelivery;
  /** (Coordinator, integration phase) See `FedosCommerceOrderResult.deliverySyncOutcome`'s own doc -- same field, same `"delivery"` channel, here for the buyer's "I received it" notification to the seller's process. */
  readonly deliverySyncOutcome?: string;
}

interface FedosCommerceReceiptIssueResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly qrText?: string;
  /** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- a real, scannable QR PNG data URL rendered from `qrText` (friction-ledger row #11 / arc §34). Omitted (never a fabricated placeholder) if rendering failed -- `qrText` alone remains the authoritative proof either way. */
  readonly qrImageDataUrl?: string;
  readonly verifyStatus?: string;
}

/** FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 3, seller-side "Share Product" result. */
interface FedosCommerceShareIssueResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly qrText?: string;
  readonly qrImageDataUrl?: string;
  readonly productId?: string;
  readonly title?: string;
}

/** Structural, unconfirmed preview parsed from a share code -- NEVER
 * trustworthy on its own (see `handleCommerceShareOpen`'s own header);
 * `confirmed` on the containing result is the only field that says whether
 * this preview was independently corroborated. */
interface FedosCommerceSharePreview {
  readonly productId: string;
  readonly title: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly sellerPubkey: string;
}

/** FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
 * arc mandate item 3, buyer-side "Open a share code" result.
 * `outcome: "ok"` + `confirmed: false` means the code itself verified but
 * could not yet be independently corroborated (offline/not-yet-synced) --
 * NEVER equivalent to `confirmed: true`, and the renderer must not open
 * Product Detail in that case. `outcome: "rejected"` means the code's
 * claimed seller does NOT match the real, network-verified record. */
interface FedosCommerceShareOpenResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly confirmed?: boolean;
  readonly productId?: string;
  readonly preview?: FedosCommerceSharePreview;
}

/**
 * FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's
 * read-only Persona Board view. Mirrors `PersonaBoardPublicView`/
 * `PersonaBoardAuthorizedView` structurally (`src/os/commerce/reputation/disclosure_layers.ts`)
 * -- this renderer only ever receives the `"PUBLIC"` layer (see
 * `commercePersonaBoardQuery`'s own preload/main doc comments), so every
 * field here is one that layer actually carries.
 */
interface FedosCommercePersonaBoardView {
  readonly layer: string;
  readonly epochId: string;
  readonly verifiedTradeCountBucket?: string;
  readonly primaryCategory?: string;
  readonly attestationRefs: readonly string[];
}

interface FedosCommercePersonaBoardVerificationState {
  readonly epochKnown: boolean;
  readonly epochCurrentlyValid: boolean;
  readonly totalStoredAttestations: number;
  readonly validSignatureAttestations: number;
  readonly rejectedSignatureAttestations: number;
}

interface FedosCommercePersonaBoardQueryResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly view?: FedosCommercePersonaBoardView;
  readonly verificationState?: FedosCommercePersonaBoardVerificationState;
}

/** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's NetworkProfile Settings surface. Real exported literal names from `src/os/commerce/catalog/network_profile.ts`. */
type FedosCommerceNetworkProfile = "local-only" | "direct" | "tor-optional";

interface FedosCommerceNetworkProfileResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly profile?: FedosCommerceNetworkProfile;
}

/** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- arc §38 / friction-ledger row #17. */
interface FedosCommerceProductImageAttachResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly media?: { readonly id: string; readonly productId: string; readonly contentType: string; readonly altText: string };
}

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) -- arc §35-37 / friction-ledger row #15. Deliberately carries
 * ONLY opaque `contentBase64`/`contentType` on success, or a
 * closed-vocabulary `reason` on denial -- never a `MediaAccessGrant`
 * envelope, a content key, AEAD internals, or a CID/storageRef.
 */
interface FedosCommerceMediaGrantRedeemResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly contentBase64?: string;
  readonly contentType?: string;
}

/** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- arc §32/§36 / friction-ledger row #14. */
interface FedosCommerceActivitySummaryResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly asBuyer?: {
    readonly draft: number;
    readonly awaitingSellerAcceptance: number;
    readonly readyToPay: number;
    readonly inFulfillment: number;
    readonly readyToAcknowledge: number;
    readonly readyToComplete: number;
    readonly readyReceipts: number;
  };
  readonly asSeller?: {
    readonly newSubmitted: number;
    /** FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- seller's own "which are unpaid?" bucket. */
    readonly unpaid: number;
    readonly paidReadyToFulfill: number;
    readonly fulfillingInProgress: number;
    readonly completedAwaitingReceipt: number;
  };
}

interface FedosAppBridge {
  readonly conversationsList: () => Promise<FedosAppCommandResult>;
  readonly conversationOpen: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly conversationActivate: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly messagesList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly messageReveal: (messageId: string) => Promise<FedosAppCommandResult>;
  readonly messageSend: (conversationId: string, body: string) => Promise<FedosAppCommandResult>;
  readonly membershipList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly invitationsList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly createInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) => Promise<FedosAppCommandResult>;
  readonly search: (query: string) => Promise<FedosAppCommandResult>;
  readonly archiveInspect: (sourcePath: string) => Promise<FedosAppCommandResult>;
  readonly archiveExport: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archivePreflightRestore: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archiveRestore: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archiveWorkflowWarnings: (operation: "inspect" | "preflightRestore" | "export" | "restore") => Promise<FedosAppCommandResult>;
  readonly archiveChooseExportDestination: (conversationId: string) => Promise<{ readonly outcome: string; readonly path?: string }>;
  readonly archiveChooseSource: () => Promise<{ readonly outcome: string; readonly path?: string }>;
  readonly devicesList: () => Promise<FedosAppCommandResult>;
  readonly deviceDetail: (deviceId: string) => Promise<FedosAppCommandResult>;
  readonly deviceRevoke: (deviceId: string, devicePublicKeyHex: string) => Promise<FedosAppCommandResult>;
  readonly deviceSyncStatus: () => Promise<FedosAppCommandResult>;
  readonly devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) => Promise<FedosAppCommandResult>;
  readonly devicePairingInspect: (encodedRequest: string) => Promise<FedosAppCommandResult>;
  readonly devicePairingApprove: (encodedRequest: string) => Promise<FedosAppCommandResult>;
  readonly devicePairingComplete: (pairingId: string, encodedApproval: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionList: (limit?: number, offset?: number) => Promise<FedosAppCommandResult>;
  readonly identityTransitionOpen: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionAccept: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionReject: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionDefer: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionRecordManualVerification: (method: string, noteCode: string) => Promise<FedosAppCommandResult>;
  readonly deletionRequestListReceived: () => Promise<FedosAppCommandResult>;
  readonly deletionRequestOpen: (requestId: string) => Promise<FedosAppCommandResult>;
  readonly deletionRequestApprove: (requestId: string) => Promise<FedosAppCommandResult>;
  readonly deletionRequestReject: (requestId: string) => Promise<FedosAppCommandResult>;
  readonly safetyCenterOverview: () => Promise<FedosAppCommandResult>;
  readonly settingsLoad: () => Promise<FedosAppCommandResult>;
  readonly relayStatus: () => Promise<FedosAppCommandResult>;
  /** Commerce Reachable Catalog + Product Surface Phase 1 — read-only. */
  readonly commerceCatalogList: () => Promise<FedosCommerceCatalogListResult>;
  /** Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- `previewActorPubkey` optional/additive, see `FedosCommerceProductDetail.isPreview`. */
  readonly commerceProductDetail: (productId: string, previewActorPubkey?: string) => Promise<FedosCommerceProductDetailResult>;
  /** Commerce E2E Completion arc — Merchant Product CRUD + Order + local Payment simulator. */
  readonly commerceMerchantProductsList: (actorPubkey: string) => Promise<FedosCommerceMerchantProductsListResult>;
  /**
   * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- `actorRole`
   * is REQUIRED and separate from `actorPubkey`/`input`: see
   * `fedos_electron_beta_main.cts`'s `handleCommerceProductCreate()` doc
   * comment (friction ledger row #2, "Unknown merchant" P0 fix).
   */
  readonly commerceProductCreate: (
    actorPubkey: string,
    actorRole: FedosCommerceActorRole,
    input: { readonly title: string; readonly description?: string; readonly priceCents: number; readonly currency: string },
  ) => Promise<FedosCommerceProductMutationResult>;
  readonly commerceProductUpdate: (
    actorPubkey: string,
    productId: string,
    patch: { readonly title?: string; readonly description?: string; readonly priceCents?: number; readonly currency?: string },
  ) => Promise<FedosCommerceProductMutationResult>;
  readonly commerceProductPublish: (actorPubkey: string, productId: string) => Promise<FedosCommerceProductMutationResult>;
  readonly commerceProductUnpublish: (actorPubkey: string, productId: string) => Promise<FedosCommerceProductMutationResult>;
  readonly commerceOrderCreate: (buyerPubkey: string, productId: string, quantity?: number) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrderSubmit: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrderCancel: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrderAccept: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrderReject: (orderId: string, actorPubkey: string, reason?: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrderFulfill: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceOrdersListMine: (actorPubkey: string) => Promise<FedosCommerceOrdersListResult>;
  readonly commerceOrdersListIncoming: (actorPubkey: string) => Promise<FedosCommerceOrdersListResult>;
  readonly commercePaymentRequest: (orderId: string) => Promise<FedosCommercePaymentRequestResult>;
  readonly commercePaymentSimulate: (orderId: string, paymentId: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceDeliveryStatus: (orderId: string) => Promise<FedosCommerceDeliveryStatusResult>;
  readonly commerceDeliveryAcknowledgeReceipt: (orderId: string, actorPubkey: string) => Promise<FedosCommerceDeliveryAcknowledgeResult>;
  readonly commerceOrderComplete: (orderId: string, actorPubkey: string) => Promise<FedosCommerceOrderResult>;
  readonly commerceReceiptIssue: (orderId: string) => Promise<FedosCommerceReceiptIssueResult>;
  /** FedOS Commerce Purchase Completion mega-arc (Agent R) -- read-only companion to `commerceReceiptIssue`: looks up an already-issued receipt without ever minting one (`outcome: "not-found"` if none exists yet). */
  readonly commerceReceiptLookup: (orderId: string) => Promise<FedosCommerceReceiptIssueResult>;
  /** FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) --
   * arc mandate item 3: signed Product Share Proof. Only the product's own
   * creator may issue a share for it (enforced main-process-side). */
  readonly commerceShareProductIssue: (actorPubkey: string, productId: string) => Promise<FedosCommerceShareIssueResult>;
  /** Decodes+verifies a pasted/scanned share code and cross-checks it
   * against the real, network-verified record -- see that handler's own
   * header for the full two-layer trust model. Never trusts `qrText`'s
   * content directly. */
  readonly commerceShareOpen: (qrText: string) => Promise<FedosCommerceShareOpenResult>;
  /** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent R's read-only Persona Board query, always the "PUBLIC" disclosure layer. */
  readonly commercePersonaBoardQuery: (subjectPubkey: string) => Promise<FedosCommercePersonaBoardQueryResult>;
  /** FedOS Commerce FINAL Closure Mega-Arc (coordinator) -- Agent N's minimal NetworkProfile Settings surface. */
  readonly commerceNetworkProfileGet: () => Promise<FedosCommerceNetworkProfileResult>;
  readonly commerceNetworkProfileSet: (profile: FedosCommerceNetworkProfile) => Promise<FedosCommerceNetworkProfileResult>;
  /** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- arc §38 / friction-ledger row #17: attach a real, public product image. */
  readonly commerceProductImageAttach: (actorPubkey: string, productId: string, imageBase64: string, contentType: string, altText?: string) => Promise<FedosCommerceProductImageAttachResult>;
  /** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- arc §35-37 / friction-ledger row #15: redeem a grant-gated purchased digital content item. */
  readonly commerceMediaGrantRedeem: (orderId: string, actorPubkey: string) => Promise<FedosCommerceMediaGrantRedeemResult>;
  /** FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent D) -- arc §32/§36 / friction-ledger row #14: real activity/badge counts for both buyer and seller roles. */
  readonly commerceActivitySummary: (actorPubkey: string) => Promise<FedosCommerceActivitySummaryResult>;
}

interface Window {
  readonly fedosProfile: FedosProfileBridge;
  readonly fedosBeta: FedosBetaBridge;
  /** Secure Runtime Alpha 8121-8200 — genuinely optional now: only defined when explicit acceptance mode is active (Security Finding 1, `6873d24f`). Absent (not merely unused) in an ordinary packaged production launch. */
  readonly fedosAcceptance?: FedosAcceptanceBridge;
  readonly fedosApp: FedosAppBridge;
}

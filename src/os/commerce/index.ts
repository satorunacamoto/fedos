/**
 * OS Capability Modularization — Factory/Port Completion pass. Public API
 * barrel for `os/commerce`.
 *
 * `src/os/commerce` is inert scaffolding carried forward from a pre-pivot
 * prototype (`src/os/commerce/README.md`) — not reachable from the shipped
 * FedOS Desktop Electron app. This barrel exists anyway, per this arc's
 * own "add barrels where safe" instruction, so a future consumer (or a
 * revival of this capability) has one canonical entrypoint rather than
 * needing to know the internal `catalog/`/`payment/`/`marketplace/`/
 * `creator/` layout.
 *
 * Re-exports:
 *   - `createCommerce()`/`Commerce`/`CommerceDependencies` — the public
 *     composition entrypoint added this pass (`./create_commerce.js`; see
 *     that file's own header for why `messaging`/`storage` are NOT
 *     accepted dependencies, unlike the plan's speculative sketch).
 *   - `ProductDirectory`/`InMemoryProductDirectory` (catalog) and the
 *     `Product`/`PurchaseGrant` shapes real code actually names.
 *   - `PaymentProvider` and its two real implementations
 *     (`NoopPaymentProvider`, `PlaceholderPaymentProvider`).
 *   - `MarketplaceProvider` and its one real implementation
 *     (`NoopMarketplaceProvider`).
 *
 * DELIBERATELY NOT RE-EXPORTED: `creator/` (profile/trust/entitlement
 * scaffolding, no consumer of this barrel needs it to construct a
 * `Commerce`), `support/` (reserved Telegram seam, no implementation
 * exists), `payment/adapters/btcpay/` (reserved, no implementation
 * exists), `catalog/adapters/nostr/` (the one place commerce is allowed
 * to touch a raw Nostr event — internal wiring detail, not public
 * surface).
 *
 * Merchant Product CRUD + Product Media + MediaStore Port arc adds:
 *   - `ProductRepositoryPort`/`LocalProductRepository` (merchant CRUD;
 *     `LocalProductRepository` also satisfies `ProductDirectory`, so it
 *     can be handed straight to `createCommerce({ catalog })`).
 *   - `ProductMedia`/`ProductMediaRepositoryPort`/
 *     `LocalProductMediaRepository` (media records per product).
 *   - `MediaStorePort`/`LocalMediaStore` (content-addressed media bytes).
 *   - `product_media_content_address.js`/`product_media_encryption.js`/
 *     `safe_media_reference.js`/`product_media_playback.js` — deliberately
 *     NOT barreled (narrow, task-specific helpers); import them directly
 *     by path, matching how `./catalog/policy.js` itself is not barreled
 *     either.
 *
 * Commerce E2E Completion arc (coordinator integration gate) adds:
 *   - The full `./order/index.js` barrel (Agent O's own scoped barrel),
 *     re-exported here so the composition root can construct a
 *     `LocalOrderRepository` and drive `applyOrderAction()`/`createOrder()`
 *     the same way it already does for `LocalProductRepository`.
 *   - The full `./delivery/index.js` barrel (Agent D's, Wave B) and
 *     `./receipt/index.js` barrel (Agent T's, Wave B) — same "per-agent
 *     scoped barrel, re-exported here at the coordinator's own integration
 *     gate" pattern. `./events/` (Agent N's, Wave B) is deliberately NOT
 *     re-exported here yet — Nostr publication is optional (per this
 *     arc's own instruction) and not wired into the Electron composition
 *     root this pass; import it directly by path if/when that changes.
 *
 * FedOS Commerce FINAL Closure Mega-Arc (Agent N) adds, still under
 * `./events/` and still deliberately NOT re-exported here for the same
 * "optional, not yet activated" reason above — the coordinator's own
 * future composition-root wiring is the right place to decide whether/how
 * to surface these:
 *   - `./events/commerce_nostr_event_port.js`'s `CommerceNostrEventPortImpl`
 *     now takes an explicit `NetworkProfile` (`./catalog/network_profile.js`
 *     — already barreled? no, also imported directly by path today) so
 *     Nostr publication can be gated `"local-only"` (LOCAL_ONLY, always
 *     refused), `"direct"` (NOSTR_OPTIONAL, the default), or
 *     `"tor-optional"` (SERVERLESS_PRIVACY, a future transport's own
 *     routing preference only — never an anonymity claim).
 *   - `./events/commerce_nostr_event_read_model.js`'s
 *     `CommerceNostrProductReadModel` — the SUBSCRIBE/inbound counterpart
 *     `commerce_nostr_event_port.ts`'s own header previously flagged as
 *     unbuilt. Transport-agnostic; consumes an
 *     `InboundCommerceNostrEnvelope`.
 *   - `./catalog/adapters/nostr/commerce_inbound_event_bridge.js`'s
 *     `verifyAndBuildInboundCommerceNostrEnvelope()` — the real
 *     `NobleSignatureVerifier`-backed bridge from a signed `NostrEvent`
 *     into that read model's input shape (reserved adapter directory,
 *     same as the pre-existing outbound `commerce_event_bridge.ts`).
 * TODO (coordinator): if/when Nostr publication is activated, wire a real
 * `RealCommerceNostrEventTransport` (`./catalog/adapters/nostr/
 * commerce_event_bridge.ts`, pre-existing) into a `CommerceNostrEventPort`
 * for outbound, and `verifyAndBuildInboundCommerceNostrEnvelope()` +
 * `CommerceNostrProductReadModel` for inbound, from the Electron
 * composition root — plus a user-visible Settings control for the
 * `NetworkProfile` (LOCAL_ONLY / NOSTR_OPTIONAL / SERVERLESS_PRIVACY)
 * itself. None of that is done by this wave; see
 * `test/commerce_nostr_event_read_model.test.ts` and
 * `test/commerce_inbound_event_bridge.test.ts` for the real, tested
 * behavior available to wire up.
 *
 * BOUNDARY CHECK (re-verify after any future edit to this file): `os/commerce`
 * must never import `os/messenger` (old or new location), and no
 * Telegram/BTCPay SDK specifier may leak outside its own reserved adapter
 * directory (`test/architecture_boundary_commerce.test.ts`) — nothing
 * re-exported below originates from `os/messenger` or a Telegram/BTCPay
 * SDK, so this barrel adds no new edge. Re-run
 * `node scripts/architecture_cycle_detector.mjs` after changing this
 * file.
 */

export { createCommerce, type Commerce, type CommerceDependencies } from "./create_commerce.js";

export {
  InMemoryProductDirectory,
  findProductById,
  listViewableProducts,
  getProductAssets,
  type ProductDirectory,
  type ProductAsset,
} from "./catalog/directory.js";
export type { Product, ProductKind, ProductStatus, ProductVisibility, PurchaseGrant, PurchaseGrantSource } from "./catalog/types.js";

export { LocalProductRepository } from "./catalog/local_product_repository.js";
export type {
  ProductRepositoryPort,
  CreateProductInput,
  UpdateProductInput,
  ProductRepositoryMutationResult,
} from "./catalog/product_repository_port.js";
// Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
// Closure arc (Agent D) -- durable, restart-surviving sibling of
// `LocalProductRepository` above, same `ProductRepositoryPort`, backed by
// an append-only NDJSON log file (this codebase's own established local
// persistence convention -- see that file's own header for the precedent
// it follows).
export { DurableProductRepository } from "./catalog/persistence/durable_product_repository.js";
export { generateFedosProductId, generateFedosProductMediaId } from "./catalog/product_id.js";

export { LocalProductMediaRepository } from "./catalog/local_product_media_repository.js";
export type {
  ProductMediaRepositoryPort,
  AddProductMediaInput,
  ProductMediaRepositoryMutationResult,
} from "./catalog/product_media_repository_port.js";
export { validateProductMedia } from "./catalog/product_media_types.js";
export type {
  ProductMedia,
  ProductMediaRole,
  ProductMediaClassification,
  ProductMediaChecksumSubject,
  ProductMediaValidationDecision,
} from "./catalog/product_media_types.js";

export { LocalMediaStore } from "./catalog/local_media_store.js";
export type {
  MediaStorePort,
  MediaObject,
  MediaObjectMetadata,
  MediaStorePutRequest,
  MediaStorePutResult,
} from "./catalog/media_store_port.js";

// FedOS Commerce FINAL Closure Mega-Arc (coordinator, central integration
// pass) -- `IpfsMediaStore` (Agent M's own lane, plus the earlier Commerce
// E2E Completion arc groundwork) is now genuinely composed by the Electron
// composition root (`fedos_electron_beta_main.cts`'s own `commerceMediaStoreFor()`),
// so it belongs in this barrel now, following this file's own established
// "add barrels where safe" instruction. `WasmProductMediaEncryption`/
// `WasmProductMediaDecryption` are barreled alongside it -- the composition
// root needs both constructors to inject the app's real, shared
// `FedosMasterSeedAuthority` instance (see those two files' own headers for
// the fail-closed-until-injected discipline this barrel does not change).
export { IpfsMediaStore, InMemoryIpfsTransport, type IpfsTransport } from "./catalog/ipfs_media_store.js";
export { WasmProductMediaEncryption, type WasmProductMediaEncryptionDeps } from "./catalog/wasm_product_media_encryption.js";
export { WasmProductMediaDecryption, type WasmProductMediaDecryptionDeps } from "./catalog/wasm_product_media_decryption.js";
export {
  UnavailableProductMediaEncryption,
  contentAddressPublicMedia,
  encryptThenContentAddressProtectedMedia,
  type ProductMediaEncryptionPort,
} from "./catalog/product_media_encryption.js";
export { UnavailableProductMediaDecryption, type ProductMediaDecryptionPort } from "./catalog/product_media_decryption.js";

// Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
// Closure arc (Agent G) -- `MediaAccessGrant`: binds protected-media
// decryption capability to a specific buyer/media/qualifying-Order/time
// window via a signed, revocable grant. Barreled here so a future
// composition-root wiring (no live "download protected media" IPC surface
// exists in the shipped app yet — see this arc's own final report) has a
// single, public entry point to import from, same as every other
// Commerce capability in this file.
export {
  isQualifyingOrderStatusForMediaAccess,
  evaluateMediaAccessGrant,
  type MediaAccessDecision,
  type MediaAccessDenialReason,
  type EvaluateMediaAccessGrantInput,
} from "./media_grant/media_access_grant_policy.js";
export {
  signMediaAccessGrant,
  verifyMediaAccessGrantEnvelope,
  MEDIA_ACCESS_GRANT_ENVELOPE_VERSION_1,
  MEDIA_ACCESS_GRANT_ENVELOPE_TYPE,
  type MediaAccessGrantSigningKeypair,
  type MediaAccessGrantVerifyResult,
  type MediaAccessGrantVerifyStatus,
} from "./media_grant/media_access_grant_sign_verify.js";
export {
  type MediaAccessGrantPayload,
  type MediaAccessGrantEnvelope,
  isWellFormedMediaAccessGrantPayload,
  mediaAccessGrantKey,
} from "./media_grant/media_access_grant_types.js";
export {
  AppendOnlyMediaAccessGrantPersistence,
  latestGrantVersion,
  type MediaAccessGrantPersistence,
  type MediaAccessGrantPersistenceWriteResult,
} from "./media_grant/media_access_grant_persistence.js";
export {
  wrapMediaAccessGrantRelease,
  unwrapMediaAccessGrantRelease,
  MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES,
  type WrapMediaAccessGrantReleaseInput,
  type WrapMediaAccessGrantReleaseResult,
  type UnwrapMediaAccessGrantReleaseInput,
} from "./media_grant/media_access_grant_key_release.js";

// FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
// (Agent D) -- the first REAL production caller wiring for the
// MediaAccessGrant system above: merchant-side issuance orchestration, and
// durable, sealed-at-rest custody for the merchant's real grant-signing
// keypair. See each file's own header for the full design + the disclosed
// "seller-not-grant-capable" limitation for the shipped Commerce demo's
// fixed, non-cryptographic actor pubkeys.
export {
  issueMediaAccessGrantsForOrder,
  type IssueMediaAccessGrantsForOrderInput,
  type IssueMediaAccessGrantsForOrderOutcome,
  type IssueMediaAccessGrantsForOrderOrderLike,
  type IssueMediaAccessGrantsForOrderMediaLike,
} from "./media_grant/media_access_grant_issuance.js";
export {
  resolveCommerceMediaGrantSigningKeypair,
  COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE,
  COMMERCE_MEDIA_GRANT_SIGNING_KEY_ID,
  type MediaGrantSigningKeyResolveResult,
  type MediaGrantSigningKeySealingAuthorityLike,
} from "./media_grant/persistence/durable_media_grant_signing_key_store.js";

export type {
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
  PaymentDecision,
  PaymentRail,
  PaymentStatus,
  PaymentCapability,
  // `PaymentEvidence` added (Compatibility Facade Reduction + Package
  // Extraction Readiness + Remaining Architecture Debt Closure arc,
  // Agent F) -- `PaymentProvider.observePayment()`/`ingestCallback()`
  // (Agent P's BTCPay-readiness widening) both return/consume it; a
  // barrel consumer implementing or calling either method needs the type
  // in scope, so it belongs alongside `PaymentProvider` itself.
  PaymentEvidence,
  // `PaymentEvidenceProvenance` added (Payment Hardening +
  // PaymentEvidence/PaymentStatus + local simulator, Commerce E2E
  // Completion arc, Agent P) -- the WHO/WHAT-produced-this-evidence
  // discriminant a caller needs in scope to construct or inspect
  // `PaymentEvidence.verification`. `AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES`
  // is the runtime allowlist `payment/state_machine.ts` checks against.
  PaymentEvidenceProvenance,
} from "./payment/types.js";
export { AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES } from "./payment/types.js";
export { NoopPaymentProvider, PlaceholderPaymentProvider, type PlaceholderPaymentProviderOptions } from "./payment/noop_payment.js";
export {
  DeterministicLocalPaymentProvider,
  TEST_SIMULATOR_NAME,
  type DeterministicLocalPaymentProviderOptions,
  type SimulatedSettlementOutcome,
} from "./payment/local_simulator.js";
export {
  applySettlementEvidence,
  createPendingSettlement,
  PaymentSettlementLedger,
  type PaymentSettlementState,
  type SettlementApplyOutcome,
  type SettlementApplyResult,
  type SettlementStatus,
  type SettlementTransitionRecord,
} from "./payment/state_machine.js";
// Commerce Durability arc (Agent D) -- durable, restart-surviving sibling
// of `PaymentSettlementLedger` above; same `apply()`/`get()` contract,
// backed by the same append-only NDJSON convention.
export { DurablePaymentSettlementLedger } from "./payment/persistence/durable_payment_settlement_ledger.js";
export { computeHmacSha256Hex, verifyHmacSha256Hex } from "./payment/callback_verification.js";

export {
  ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  applyOrderAction,
  createOrder,
  getAvailableActions,
  isTerminalOrderStatus,
  LocalOrderRepository,
  // Commerce Durability arc (Agent D) -- durable, restart-surviving
  // sibling of `LocalOrderRepository`, same `OrderRepository` Port.
  DurableOrderRepository,
  buildCreateOrderDraft,
  buildCustomerOrderStatusViewModel,
  buildMerchantIncomingOrdersViewModel,
  buildMerchantOrderDetailViewModel,
  buildOrderReviewViewModel,
  describeOrderStatus,
  CustomerOrderController,
  MerchantOrderController,
  type CreateOrderInput,
  // NOTE: order/order_types.ts also defines a local `DeliveryStatus`
  // placeholder (Agent O never imported the real one from `./delivery/`,
  // same reasoning as its own `PaymentStatus` placeholder below). Aliased
  // here to avoid colliding with the real `DeliveryStatus` exported below
  // from `./delivery/index.js`.
  type DeliveryStatus as OrderPlaceholderDeliveryStatus,
  type Order,
  type OrderAction,
  type OrderActionType,
  type OrderActor,
  type OrderActorKind,
  type OrderDeliveryEvidence,
  type OrderHistoryActionType,
  type OrderPaymentEvidence,
  type OrderRejectionCode,
  type OrderStatus,
  type OrderTransitionRecord,
  type OrderTransitionResult,
  // NOTE: `order/order_types.ts` also defines a local `PaymentStatus`
  // placeholder (Agent O never imported the real one from `./payment/types.js`
  // — see that file's own header). Aliased here to avoid colliding with the
  // real `PaymentStatus` already exported above from `./payment/types.js`.
  type PaymentStatus as OrderPlaceholderPaymentStatus,
  type OrderRepository,
  type CreateOrderDraftResult,
  type MerchantIncomingOrdersViewModel,
  type MerchantOrderDetailViewModel,
  type MerchantOrderSummary,
  type OrderReviewViewModel,
  type OrderStatusViewModel,
} from "./order/index.js";

// FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
// (Agent D) -- friction-ledger row #14 / arc §32/§36: the real,
// repository-derived activity/badge counting logic.
export {
  computeCommerceBuyerActivitySummary,
  computeCommerceSellerActivitySummary,
  type CommerceActivitySummaryOrderLike,
  type CommerceBuyerActivitySummary,
  type CommerceSellerActivitySummary,
} from "./order/activity_summary.js";

// FedOS Commerce "Purchase Completion" mega-arc (Agent U) -- honest
// sync/connection-state derivation, cross-process sync-outcome copy, and
// the bounded "where is my order?" landing pointer. Same "pure, tested;
// the composition root only wires it in" discipline as the activity
// summary above.
export {
  deriveCommerceSyncStatus,
  describeCommerceSyncStatus,
  CommerceSyncTracker,
  type CommerceSyncStatus,
  type CommerceSyncSnapshot,
  type CommerceSyncStatusText,
} from "./order/sync_state.js";

export {
  describeCommerceSyncOutcome,
  isCommerceSyncOutcomeConcerning,
  type KnownCommerceSyncOutcome,
} from "./order/cross_process_outcome_text.js";

export {
  buildCommerceLandingPointer,
  type CommerceLandingPointer,
} from "./order/landing_pointer.js";

export {
  AUTHORITATIVE_DELIVERY_EVIDENCE_SOURCES,
  DELIVERY_STATUSES,
  TERMINAL_DELIVERY_STATUSES,
  buildDeliveryReceiptArtifact,
  applyDeliveryAction,
  createDelivery,
  getAvailableDeliveryActions,
  isTerminalDeliveryStatus,
  LocalDeliveryRepository,
  DurableDeliveryRepository,
  type CreateDeliveryInput,
  type DeliveryAction,
  type DeliveryActionType,
  type DeliveryActor,
  type DeliveryActorKind,
  type DeliveryEvidence,
  type DeliveryEvidenceProvenance,
  type DeliveryHistoryActionType,
  type DeliveryReceiptArtifact,
  type DeliveryRecord,
  type DeliveryRejectionCode,
  type DeliveryStatus,
  type DeliveryTransitionRecord,
  type DeliveryTransitionResult,
  type MerchantDeliveryClaim,
  type DeliveryRepository,
} from "./delivery/index.js";

export {
  isWellFormedTradeReceiptProofPayload,
  isWellFormedDeliveryReceiptProofPayload,
  canonicalizeTradeReceiptProofPayloadV1,
  canonicalizeDeliveryReceiptProofPayloadV1,
  issueSignedTradeReceiptProof,
  issueSignedDeliveryReceiptProof,
  verifySignedTradeReceiptProof,
  verifySignedDeliveryReceiptProof,
  encodeCommerceReceiptProofToQrText,
  decodeCommerceReceiptProofFromQrText,
  type CommerceReceiptProofKind,
  type TradeReceiptProofPayload,
  type DeliveryReceiptProofPayload,
  type SignedCommerceReceiptProofEnvelope,
  type CommerceReceiptSigningKeys,
  type IssueCommerceReceiptProofOptions,
  type CommerceReceiptVerifyStatus,
  type CommerceReceiptVerifyResult,
} from "./receipt/index.js";

// FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
// (Agent D) -- durable, idempotent persistence for an ISSUED receipt
// envelope, closing friction-ledger row #5 ("receipt regenerates on every
// call, never separately stored"). See the file's own header for the full
// account of what was already fixed (the issuer's signing KEY) vs. what
// this file fixes (the envelope ITSELF).
export {
  DurableReceiptStore,
  type PersistedCommerceReceiptRecordV1,
  type DurableReceiptStorePutResult,
} from "./receipt/persistence/durable_receipt_store.js";

export type {
  MarketplaceProvider,
  MarketplaceStatus,
  MarketplaceListDecision,
  MarketplacePurchaseDecision,
  MarketplacePurchaseRequest,
  MarketplaceItemKind,
  MarketplaceVisibility,
} from "./marketplace/types.js";
export { NoopMarketplaceProvider } from "./marketplace/noop_marketplace.js";

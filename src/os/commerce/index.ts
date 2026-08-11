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
export { computeHmacSha256Hex, verifyHmacSha256Hex } from "./payment/callback_verification.js";

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

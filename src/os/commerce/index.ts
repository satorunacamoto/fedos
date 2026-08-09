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

export type {
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
  PaymentDecision,
  PaymentRail,
  PaymentStatus,
  PaymentCapability,
} from "./payment/types.js";
export { NoopPaymentProvider, PlaceholderPaymentProvider } from "./payment/noop_payment.js";

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

/**
 * Stage 111 — `NoopMarketplaceProvider`: a marketplace provider that does nothing.
 *
 * The only implementation this stage ships, and the only one `createRuntime`
 * selects. It is permanently `unavailable`: it lists nothing, charges
 * nothing, grants nothing, and issues no `fetch`. Every method is total and
 * never throws.
 *
 * NOT wired into `PaymentProvider`, `src/commerce/` (`PurchaseGrant`),
 * `StorageBackend`, any `CryptoProvider`, or the Worker.
 */

import type {
  MarketplaceListDecision,
  MarketplaceProvider,
  MarketplacePurchaseDecision,
  MarketplacePurchaseRequest,
  MarketplaceStatus,
} from "./types.js";

export class NoopMarketplaceProvider implements MarketplaceProvider {
  constructor() {
    // Does nothing: no provider present, no payment rail contacted.
  }

  status(): MarketplaceStatus {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no marketplace provider is configured",
    };
  }

  async listPlaceholder(): Promise<MarketplaceListDecision> {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no marketplace provider is configured (nothing listed)",
      items: [],
    };
  }

  async purchasePlaceholder(
    _request: MarketplacePurchaseRequest,
  ): Promise<MarketplacePurchaseDecision> {
    // Reads nothing from the request; charges nothing; grants nothing.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no marketplace provider is configured (nothing purchased)",
    };
  }
}

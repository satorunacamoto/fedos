/**
 * OS Capability Modularization — Factory/Port Completion pass.
 * `createCommerce()`.
 *
 * Unlike `createMessenger()` (`../messenger/create_messenger.ts`), this
 * factory is NOT blocked on a missing Port — per
 * `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`'s own finding, every
 * individual commerce piece checked (`InMemoryProductDirectory`,
 * `NoopPaymentProvider`/`PlaceholderPaymentProvider`,
 * `NoopMarketplaceProvider`) already takes its dependencies via
 * constructor parameters with zero module-level singletons. What was
 * missing was purely the `Commerce` aggregate type and this factory —
 * both added here.
 *
 * FIELD NAMES, VERIFIED AGAINST REAL CODE, NOT THE PLAN'S SPECULATIVE
 * SNIPPET: the plan's own target usage sketch names `{ payments,
 * messaging, storage }` as `createCommerce()`'s dependencies. Neither
 * `messaging` nor `storage` is accepted here — verified (grep, this pass):
 * zero references to `MessagingPort` or `StorageBackend` exist anywhere
 * under `src/os/commerce/**` today. `commerce_bridge.ts`'s bridge
 * functions are pure `Product`/`PaymentDecision` transforms with no
 * Messenger or storage dependency at all. Accepting parameters no real
 * code would consume would be inventing, not verifying, a shape — this
 * factory instead accepts the THREE pieces the real code actually has:
 * `catalog`, `payments`, `marketplace`.
 *
 * `src/os/commerce/**` is also architecturally forbidden from importing
 * `os/messenger` at all (`test/architecture_boundary_commerce.test.ts`),
 * so a `messaging` dependency of type `MessagingPort` would be fine
 * (the Port itself lives in `os/core`, not `os/messenger`) but still
 * unused by anything real — the boundary rule is not the blocker here;
 * the absence of any real consumer is.
 *
 * SAFE DEFAULTS ONLY: any piece a caller omits falls back to the
 * corresponding real `Noop*`/empty default — every method total, never
 * throws, zero external contact, zero money moved. Calling
 * `createCommerce()` with no arguments at all is always safe.
 */

import type { MarketplaceProvider } from "./marketplace/types.js";
import { NoopMarketplaceProvider } from "./marketplace/noop_marketplace.js";
import type { PaymentProvider } from "./payment/types.js";
import { NoopPaymentProvider } from "./payment/noop_payment.js";
import { InMemoryProductDirectory, type ProductDirectory } from "./catalog/directory.js";

export interface CommerceDependencies {
  /** OPTIONAL — defaults to an empty `InMemoryProductDirectory` (lists nothing). */
  readonly catalog?: ProductDirectory;
  /** OPTIONAL — defaults to `NoopPaymentProvider` (charges nothing, permanently unavailable). */
  readonly payments?: PaymentProvider;
  /** OPTIONAL — defaults to `NoopMarketplaceProvider` (lists/charges nothing, permanently unavailable). */
  readonly marketplace?: MarketplaceProvider;
}

/**
 * The Commerce capability's public composition surface: the three real
 * provider-shaped pieces, resolved to either the caller's real
 * implementation or a safe Noop/empty default. Every field is always
 * present — a consumer never needs to null-check.
 */
export interface Commerce {
  readonly catalog: ProductDirectory;
  readonly payments: PaymentProvider;
  readonly marketplace: MarketplaceProvider;
}

/**
 * Constructs a `Commerce` from already-built providers (or safe
 * Noop/empty defaults for whichever are omitted). Performs no I/O itself
 * — purely an aggregation/default-resolution step, mirroring
 * `createMessenger()`'s own discipline.
 */
export function createCommerce(deps: CommerceDependencies = {}): Commerce {
  return {
    catalog: deps.catalog ?? new InMemoryProductDirectory([]),
    payments: deps.payments ?? new NoopPaymentProvider(),
    marketplace: deps.marketplace ?? new NoopMarketplaceProvider(),
  };
}

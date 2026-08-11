/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #6).
 *
 * A `ProductRepositoryPort` is the persistence seam `create_commerce.ts`'s
 * own header notes was deliberately absent: "Commerce never imports
 * `StorageBackend` at all... grep confirms nothing in `os/commerce` would
 * consume one." This Port is that explicit seam — Domain -> Port ->
 * Adapter, exactly as `README.md`'s "Dependency rule" section requires.
 * No hidden global, no direct `fs`/IndexedDB call from domain logic: a
 * caller injects a concrete adapter (`LocalProductRepository`, this same
 * pass; a future durable/remote adapter later) that implements this
 * interface.
 *
 * DELIBERATE SUPERSET OF `ProductDirectory` (`./directory.ts`): every
 * `ProductRepositoryPort` IS-A `ProductDirectory` (`list()`/`get()` have
 * the exact same signatures), so a `LocalProductRepository` instance can
 * be handed directly to `createCommerce({ catalog })` with zero adapter
 * glue — `list()` here returns every product regardless of status
 * (matching `ProductDirectory.list()`'s own existing "everything, unfiltered"
 * contract), and merchant-only/customer-only filtering is layered on top
 * via `listOwnedByMerchant()`/`listPublished()` below, never baked into
 * `list()` itself.
 *
 * MERCHANT AUTHORITY: every mutating method takes `actorPubkey` as an
 * explicit, separate parameter (never trusted from the input payload) and
 * every adapter MUST check it against `policy.ts`'s existing, already-
 * tested `canEditProduct()` before allowing a create/update/publish/
 * unpublish to proceed — an EXPLICIT check, not implicit trust, per this
 * arc's own instruction. `create()` in particular never accepts a
 * caller-supplied `creatorPubkey` in its input: authorship is always
 * `actorPubkey`, the identity that is actually calling — this closes off
 * a trivial "claim someone else's product" spoof at the type level.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app
 * (same status as every other file under `src/os/commerce/`, per
 * `README.md`). Free-standing, importable unit — no composition-root
 * wiring included here (reserved for the coordinator's integration pass).
 */

import type { Product, ProductKind, ProductVisibility } from "./types.js";
import type { ProductDirectory } from "./directory.js";

/** Input to `create()`. `creatorPubkey`/`id`/`status` are NEVER accepted here — see this file's own header. */
export interface CreateProductInput {
  readonly kind: ProductKind;
  readonly title: string;
  readonly description?: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly visibility: ProductVisibility;
  readonly linkedSpaceIds?: readonly string[];
  readonly linkedEventIds?: readonly string[];
  readonly assetIds?: readonly string[];
  readonly stock?: number;
}

/**
 * Patch for `update()`. Every field optional (only supplied fields
 * change). `status` is deliberately absent — status transitions go
 * through `publish()`/`unpublish()` only, so the lifecycle stays an
 * explicit, auditable state transition rather than a silent field write.
 */
export interface UpdateProductInput {
  readonly title?: string;
  readonly description?: string;
  readonly priceCents?: number;
  readonly currency?: string;
  readonly visibility?: ProductVisibility;
  readonly linkedSpaceIds?: readonly string[];
  readonly linkedEventIds?: readonly string[];
  readonly assetIds?: readonly string[];
  readonly stock?: number;
}

/**
 * Result of a mutating call. Mirrors this codebase's pervasive
 * `{ outcome: ... }` discriminated-union convention (e.g.
 * `FedosConversationArchiveExportResult`) rather than throwing —
 * every adapter method is expected to be total.
 */
export type ProductRepositoryMutationResult =
  | { readonly outcome: "ok"; readonly product: Product }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "forbidden"; readonly reason: string }
  | { readonly outcome: "invalid-input"; readonly reason: string };

/**
 * The persistence Port for merchant Product CRUD. Synchronous, mirroring
 * `ProductDirectory`'s own synchronous contract (this scaffolding has no
 * network dependency by design — see `create_commerce.ts`'s header) —
 * a future remote/durable adapter that needs to be async can still
 * satisfy a Promise-returning variant of this same shape without
 * changing the method names or argument order.
 */
export interface ProductRepositoryPort extends ProductDirectory {
  /** Creates a new product owned by `actorPubkey`, always starting `status: "draft"`. */
  create(actorPubkey: string, input: CreateProductInput): ProductRepositoryMutationResult;
  /** Edits an existing product's fields (never its `status`, `id`, or `creatorPubkey`). Owning merchant only. */
  update(actorPubkey: string, productId: string, patch: UpdateProductInput): ProductRepositoryMutationResult;
  /** Transitions a product to `status: "active"` (from `draft` or `archived`). Owning merchant only. */
  publish(actorPubkey: string, productId: string): ProductRepositoryMutationResult;
  /** Transitions a product to `status: "archived"` (from any status). Owning merchant only. */
  unpublish(actorPubkey: string, productId: string): ProductRepositoryMutationResult;
  /** Every product owned by `actorPubkey`, any status — the merchant-only "my listings" view. */
  listOwnedByMerchant(actorPubkey: string): readonly Product[];
  /**
   * The catalog view: active products a guest may view, reusing
   * `listViewableProducts()` (`./directory.ts`) rather than re-deriving
   * visibility rules. Equivalent to `listViewableProducts(this.list())`.
   */
  listPublished(): readonly Product[];
}
